# UX issues

This is a living document which gets updated as work gets done. It lists
problems a user would hit, found by using the app locally. Where a fix is
obvious it's named; otherwise the item only describes the problem.

1. `/discover` could benefit from search, filters, and pagination. This is
   naturally where a user would spend their time looking for the right activity,
   and pagination is needed as the list grows.
2. The purpose of `/explorer` is unclear. A user must infer it lists cities and
   that clicking into a city will show its activities. Confusing for the user,
   needs more guidance copy so that users know what to expect.
3. The "Prix" filter on `/explorer/:city` isn't useful. It matches exact prices;
   a maximum price or a range would be more intuitive.
4. When creating an Activity, nothing confirms success. After creation you land
   on `/discover`, which is disorienting, and you only find your activity by
   spotting it at the top. No action in the app shows a success message.
5. Signing up doesn't sign you in. You land on `/signin` with no message saying
   the account was created, and you have to infer that you must type your
   details again.
6. Error messages don't say what went wrong. Every failure shows "Une erreur est
   survenue", so a wrong password looks the same as a server outage.
7. Language and spelling are inconsistent. Form errors are in English on a
   French site ("Invalid email", "FirstName required"). "Connection" and
   "Déconnection" should be "Connexion" and "Déconnexion". One tab title is in
   English ("Discover").
