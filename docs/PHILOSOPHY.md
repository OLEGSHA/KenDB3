# Philosophy of KenDB3


## KenDB3 must be nice.
KenDB3 must be open source and copyleft to the greatest extent reasonable. KenDB3 must respect users' privacy; no thirdparty stuff running in the background. KenDB3 must be autonomous and self-hosted. KenDB3 must behave in expected ways and support users who want to tinker with it, including usercss and automated access. KenDB3 sources must be readable and well-documented.


## KenDB3 should be like a old-school print magazine.
Although it will have some effect on the visuals, this point is mostly about behavior and feel. Users submit entries, _real people_ called editors review them, make editorial corrections, then publish the result. Editors are not a homogenious army of biorobots following precise scripts, but trusted public figures with authority and permissions, and responsibilities to match.

KenDB3 must always retain a human aspect. There are far too many fully automated algorithm-driven websites out there already to join to the pile.


## KenDB3 is a database with opinions.
On one hand, KenDB3 will catalogue every single thing that gets submitted. On another hand, KenDB's editors will make corrections and leave comments.

Some may say these values are contradictory. They are, and we're going to follow them anyway.


## KenDB3 should be simple.
KenDB3 should use older, simpler, more lightweight technologies where reasonable.

NPM and TypeScript are used because without these tools the frontend would be an utter mess. Vue.js and GraphQL are not used because we can do without them.


## Homemade code is not bad.
KenDB3 is supposed to be interesting to work with, and writing code is more fun than writing configurations. It's a learning opportunity, too: instead of using Vue.js, we create our own replacement for it, and so we understand its design much better.

This would not apply to most projects, but KenDB3 is not entirely a serious production project.


## KenDB3 should offload as much as possible onto the client.
This improves user experience with a slow host. Backend only handles data and assets; presentation is the job of the client.
