# Chewker

## Currently supported features

- [X] When castling verify that certain blank squares are not under attack
- [X] En passant rule
- [X] Queening
- [X] Other Jack gets elevated in a suit
- [X] King's right for the king itself
- [X] Same suite is mandatory if you have it rule
- [X] Once per hand you can trade off a card
- [X] No swapping allowed when defending

## Minor bugs and features (address upon further funding)

- [ ] Castling moves are not currently highlighted though allowed
    * This doesn't prevent one from playing according to rules
- [X] Cards need to look like real stuff
- [ ] King's right for the pieces that save it from checkmate
- [ ] Clock 
- [ ] Promoted piece selection
- [X] Networking can take advantage of push technology
    - [ ] Need to actually use push for relaying moves
- [ ] Square selection needs to be improved
- [ ] Currently text gets selected for some reason when mouse is clicking on SVG
- [ ] SVG drawing should use groups instead of nested SVG elements

## Plan of action for the *lobby* feature
- [X] Establishing a SignalR connection upon login (vs. at code load time) and discarding when necessary
- [X] Upgrade "Subscribe" call to a push (from the current pull via the API)
- [X] We want to push logged-in users (say at least 100 of them)
- [X] Users can advertise themselves in a lobby
- [X] Users can accept others in a lobby
- [X] Need a way for the client to tell the server about the checkmate state
- [ ] Need a way to get rid of old games based on time
- [ ] Rating calc needs to be based on ELO 
- [ ] Lobby should empty previous lobby state upon mounting in the client

## Bugs
- [ ] Disable the make button when card not selected and replying to an attack
- [ ] Assume trump is diamons, offence is hearts, and I hold with J-H and K-H. The app should let you play only K-H. If don't have any hearts should let you play anything (including the J-H which is considered to be a diamond)

## Long term TODO
- [ ] Investigate ways in which all of this will appear in a mobile app
- [ ] Think about ways to make things redundant (aka multiple databases)
    - Maybe we could write into two (or more) databases in tandem while a read from only one would be sufficient?
- [ ] Diallow websockets somehow... maybe in the proxy... see if SignalR will actually downgrade to long polling 

