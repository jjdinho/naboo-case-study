# UX review

This is a living document which gets updated as work gets done. It lists
problems a user would hit, found by using the app locally. Where a fix is
obvious it's named; otherwise the item only describes the problem.

1. **"Explorer" is unclear.** Nothing says it lists cities, or that clicking a
   city shows its activities. It may be a terminology mismatch, so users don't
   know what to expect.
2. **`/discover` needs filters and pagination.** Filtering by city and price
   would be a better experience, and pagination is needed as the list grows.
3. **The "Prix" filter on `/explorer/:city` isn't useful.** It matches exact
   prices; a maximum price or a range would be more intuitive.
4. **Nothing confirms success.** After creating an activity you land on
   `/discover`, which is disorienting, and you only find your activity by
   spotting it at the top. No action in the app shows a success message;
   creating an activity or an account completes silently.
5. **Signing up doesn't sign you in.** You land on `/signin` with no message
   saying the account was created, and you have to type your details again.
6. **Error messages don't say what went wrong.** Every failure shows "Une erreur
   est survenue", so a wrong password looks the same as a server outage.
7. **Language and spelling are inconsistent.** Form errors are in English on a
   French site ("Invalid email", "FirstName required"). "Connection" and
   "Déconnection" should be "Connexion" and "Déconnexion". The header says
   "Candidator" but tab titles say "CDTR", and one tab title is in English
   ("Discover").
