# Reflection

## Most difficult concept and how I overcame it

The hardest concept for me was concurrency: why two requests that each look correct on their own can still break a system when they run at the same time. The double-booking problem made it concrete. I first assumed that checking whether a seat was free and then marking it sold was safe. I got past the confusion by drawing a timeline of two users side by side and seeing both of them read "available" before either one wrote. Then I learned how a transaction, a row lock and a unique constraint turn "check and claim" into one atomic step. Applying it in the TicketHub design, rather than just recognising it in a lecture, is what made it stick.

## What I would improve in my capstone

The feedback I received was that the capstone worked but did not explain how it would cope with growth or failure. I would add traffic estimates like the ones I now do for every design, put a cache and a queue in front of the slowest and busiest parts, and write down the trade-offs I made instead of leaving them implicit. I would also add constraints and transactions on the data that must never be wrong, as I did with seats and tickets.

## What I will learn next

Next I want to learn how databases work internally (indexes, locking and replication), then cloud deployment and monitoring so I can see how a system behaves under real load. After that I plan to study distributed systems more deeply, because I am heading toward systems engineering and want to understand what happens when many machines must agree.
