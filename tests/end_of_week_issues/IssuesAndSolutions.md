## Root Cause Analysis


* The latency spike is caused by the use of modelVersion “v1.3”
* Which is likely new AI or LLM models Supporting Evidence from logs
  * Response time for requests using modelVersion “v1.2” is between 90 and 120 milliseconds and there was no timeout also
  * Response time for requests using modelVersion “v1.3” is between 680 and 890 milliseconds and there are multiple timeouts




## Immediate Action


* The immediate action to take next 10 minutes is to re-route all requests to modelVersion “v1.2”. This would guarantee that the threshold would be low and the requests would not be timed-out.
* Then, notifying the 3 kenya lenders that the issues have been resolved.
* Attempting to fix the issues the modelVersion “v1.3” is not recommended
  * Quickly fixing the issues with modelVersion “v1.3” in a few minutes might lead to edge cases being missed or errors not being handled correctly.
  * Tests should be written for the fix and must be thoroughly tested
  * It is not enough time to be reviewed by team lead and other team members


## Prevention Action
* Improve the tests, specifically adding that tests the performance
* Add automatic rollback system
* Improve the alerting systems
* Benchmark and compare different AI/LLM models and pick the best one


## Retrospective Notes
* We need to re-evaluate our model validation logic as we did not catch the performance issue until it was deployed
* The logs monitored the latency spike, but our alerting system failed. We only knew about the problem after it was reported by the 3 Kenyan lenders.
* Maybe we need to set up an automatic rollback mechanism.
