# Security reports

Do not include tokens, session specifications, environment variables, raw app
logs or active public URLs in public issues. The state and session directories
contain capabilities that can control local processes.

Before public release, the repository maintainer must enable GitHub private
vulnerability reporting and test that channel. No private contact address is
invented here. Until that exists, report privately to the maintainer through
an already established channel; do not open a public exploit report.

Security-sensitive invariants: verified runtime artifacts, loopback-only
origin, authenticated worker control, correct project selection, no generic
PID/name/port kills, and no public success report without origin proof.

The local OS user can read or alter their own files and processes; Tunnel does
not isolate mutually hostile processes running as that same user. Public URL
access is governed by the application's own authentication.
