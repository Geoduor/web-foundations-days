# SnapShare Scaling Plan

SnapShare is a photo-sharing app: users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions and Daily Active Users

Given:
- 10,000,000 registered users
- 10% are active each day
- Each active user uploads 1 photo/day and views 50 feed pages/day
- Average photo = 2 MB; each photo also gets a 50 KB thumbnail

My additional assumptions:
- 1 day = 86,400 seconds
- Peak traffic = 5x the daily average
- Each feed page shows 10 photos, served as thumbnails (full photo only on tap)
- Photo metadata (id, owner, caption, URLs, timestamps) is about 1 KB per row
- Decimal units (1 MB = 1,000,000 bytes, 1 TB = 1,000,000 MB)
- Photos are never deleted (worst case for storage)

Daily active users (DAU):

    10,000,000 registered users x 10% = 1,000,000 DAU

## 2. Estimates

### Uploads per second

    Uploads/day = 1,000,000 x 1 = 1,000,000
    Average     = 1,000,000 / 86,400  = about 11.6 uploads/s
    Peak (5x)   = 11.6 x 5            = about 58 uploads/s

### Feed views per second

    Feed views/day = 1,000,000 x 50 = 50,000,000
    Average        = 50,000,000 / 86,400 = about 579 feed views/s
    Peak (5x)      = 579 x 5             = about 2,894 feed views/s

Each page shows 10 thumbnails, so thumbnail fetches are about 5,790/s on average and about 28,900/s at peak.

### Photo storage per year

    Originals   = 1,000,000 x 2 MB  = 2 TB/day
    Thumbnails  = 1,000,000 x 50 KB = 50 GB/day
    Total       = 2.05 TB/day
    Per year    = 2.05 TB x 365 = about 748 TB (about 0.75 PB)
                  (originals about 730 TB, thumbnails about 18 TB)

Metadata is small by comparison: 1,000,000 x 1 KB = 1 GB/day, about 365 GB/year.

### Bandwidth (for sizing)

| Direction | Average | Peak (5x) |
|-----------|---------|-----------|
| Upload ingress (2 MB x uploads/s) | about 23 MB/s (about 185 Mbps) | about 116 MB/s (about 0.93 Gbps) |
| Feed egress (50 KB x thumbnail fetches/s) | about 290 MB/s (about 2.3 Gbps) | about 1,450 MB/s (about 11.6 Gbps) |

This is why a CDN is essential.

## 3. Read-heavy or Write-heavy?

**SnapShare is read-heavy.** Feed views (50M/day) outnumber uploads (1M/day) by about 50 to 1 (579 reads/s vs 11.6 writes/s on average), and reads also move far more bytes than writes.

What this means for the design:
- **Cache aggressively:** keep feed pages and photo metadata in an in-memory cache so most reads never reach the database.
- **Use a CDN:** serve photos and thumbnails from edge servers so the multi-Gbps read traffic never hits our origin.
- **Add read replicas:** send read queries to replicas and keep the primary free for writes.
- **Keep app servers stateless:** so we can add more of them behind a load balancer as read traffic grows.
- **Optimize for fast reads, accept slower writes:** it is fine if a new photo takes a few seconds to appear everywhere, so we can do heavy work (thumbnails, feed updates) asynchronously.

Writes are low in count but heavy in size (2 MB each), so uploads go straight to object storage and slow work is pushed to a queue.

## 4. Why Photos Should Not Be Stored Inside the Database

Photos are large binary files, and a database is built for small, structured, queryable rows. Storing photos in it causes problems:
- **Size and cost:** at about 0.75 PB per year, database storage (fast, replicated disks) is far more expensive than object storage.
- **Slow queries and backups:** big binary blobs bloat tables, slow down queries, replication and backups, and make the replica lag.
- **Wasted database capacity:** serving 2 MB files through the database would use up connections and bandwidth that should serve queries.
- **No CDN integration:** a database cannot hand files directly to a CDN; every view would pass through app servers and the database.
- **Poor scaling:** scaling a database for petabytes of files is hard, while object storage scales almost without limit.

**Where they go instead:** photos (originals and thumbnails) go in **object storage** (for example Amazon S3 or Google Cloud Storage). It is cheap, durable (data is replicated), nearly unlimited in size, and works directly with a CDN. The database stores only the **metadata** and the **URL/key** that points to the file in object storage.

## 5. Architecture Diagram

```
                          +----------------+
                          |    Clients     |
                          | (mobile / web) |
                          +--------+-------+
                                   |
                 +-----------------+------------------+
                 | photos / thumbnails                | API requests
                 v                                    v
          +-------------+                    +-----------------+
          |     CDN     |                    |  Load Balancer  |
          +------+------+                    +--------+--------+
                 | (cache miss)                       |
                 |                  +-----------------+-----------------+
                 |                  v                 v                 v
                 |            +-----------+     +-----------+     +-----------+
                 |            | App Server|     | App Server|     | App Server|
                 |            +-----+-----+     +-----+-----+     +-----+-----+
                 |                  |  (stateless, any can handle any request)
                 |    +-------------+---------+------------------+
                 |    |                       |                  |
                 |    v                       v                  v
                 |  +-------+     +----------------------+  +-----------+
                 |  | Cache |     |       Database       |  |   Queue   |
                 |  |(Redis)|     |  Primary --> Replica |  | (jobs)    |
                 |  +-------+     |  (writes)    (reads) |  +-----+-----+
                 |                +----------------------+        |
                 |                                                v
                 |                                         +-------------+
                 |                                         |  Thumbnail  |
                 |                                         |  Worker(s)  |
                 |                                         +------+------+
                 |                                                |
                 v                                                v
          +--------------------------------------------------------------+
          |           Object Storage (original photos + thumbnails)      |
          +--------------------------------------------------------------+
```

Read path: Client -> CDN (hit: done) -> on miss, object storage. Feed metadata: Client -> Load Balancer -> App Server -> Cache -> (miss) Database read replica.
Write path: Client -> Load Balancer -> App Server -> Object Storage + Database primary + Queue -> Worker -> Object Storage.

## 6. Components, One Sentence Each

- **CDN:** Serves photos and thumbnails from servers near the user, solving the multi-Gbps read bandwidth and latency problem and keeping that load off our origin.
- **Load Balancer:** Spreads incoming requests across many app servers, solving the single-server bottleneck and single point of failure.
- **App Servers:** Run the business logic (auth, feed building, upload handling) and, being stateless, let us scale out by simply adding more servers.
- **Cache (Redis):** Keeps hot data such as feed pages and photo metadata in memory, solving repeated slow database reads for the same data.
- **Database (primary):** Stores durable, structured data (users, follows, photo metadata) and handles all writes consistently.
- **Read Replica:** Holds a copy of the primary that serves read queries, solving the read-heavy load so the primary is not overwhelmed.
- **Object Storage:** Stores the huge volume of photo files (about 0.75 PB/year) cheaply and durably, which a database cannot do economically.
- **Queue:** Holds thumbnail jobs so uploads return quickly and traffic spikes are absorbed instead of overloading workers.
- **Thumbnail Worker:** Processes queued jobs in the background to create the 50 KB thumbnail, keeping slow image processing out of the upload request.

## 7. Upload Flow, Step by Step

1. The user picks a photo in the app; the client sends an upload request through the load balancer.
2. The load balancer forwards it to an available app server.
3. The app server authenticates the user and validates the file (type and size limit).
4. The app server stores the original 2 MB file in object storage (or gives the client a pre-signed URL so the client uploads directly, keeping big files off the app servers).
5. The app server writes a metadata row (photo id, owner, storage URL, timestamp, status = "processing") to the database primary.
6. The app server puts a "create thumbnail" job (with the photo id) on the queue.
7. The app server immediately responds "upload successful" to the client, so the user does not wait for thumbnail creation.
8. **Thumbnail job:** a worker takes the job from the queue, downloads the original from object storage, resizes it to a 50 KB thumbnail, and saves the thumbnail back to object storage. If the job fails, it is retried (and moved to a dead-letter queue after repeated failures).
9. The worker updates the database row (status = "ready", thumbnail URL).
10. Feed cache entries for the uploader's followers are invalidated or updated so the new photo appears; the CDN then serves the thumbnail on first view and caches it.

## 8. Trade-offs

1. **Eventual consistency from read replicas and cache.** Replicas lag the primary slightly, and cached feeds can be stale, so a new photo may take seconds to show up in followers' feeds. We accept this because a social feed does not need instant consistency, and it lets us handle about 2,900 feed views/s at peak cheaply. The cost is occasional stale data, and "read your own write" must be handled (for example, reading the author's own photos from the primary).
2. **Asynchronous thumbnails (queue) vs. immediate availability.** Uploads respond fast and spikes are smoothed, but the thumbnail is not available right away, so the app must show a placeholder briefly. This adds complexity: retries, failed-job handling, and a "processing" status.
3. **CDN caching cost vs. freshness and complexity.** A CDN massively cuts origin bandwidth and latency, but it costs money, and changed or deleted photos may stay cached until they expire or are purged. Using immutable, versioned URLs reduces this problem.
4. **Metadata in a relational DB, files in object storage.** This is cheap and scalable for photos, but the two stores can get out of sync (file saved but DB write fails, or the reverse), so we need cleanup jobs and careful write ordering.
5. **Precomputing feeds (fan-out on write) vs. building on read.** Precomputing makes reads fast but uses more storage and write work, especially for users with many followers. Building on read is simpler but slower. For a read-heavy app, the plan favours precomputing or caching feeds.

## 9. Future Scaling Notes

- At 0.75 PB/year, add storage lifecycle rules (move old photos to cheaper tiers).
- If the database primary becomes a write bottleneck, shard by user id.
- Add more app servers and workers independently as peak load grows.
