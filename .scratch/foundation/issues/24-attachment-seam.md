# 24 — The Attachment seam

**What to build:** A developer can store a file against a Todo and read it back through authenticated routes, and no one else can. There is no interface, because none is drawn. This binds the R2 bucket and adds the Attachment metadata.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** ready-for-agent

- [ ] Upload stores the bytes under a per-user key prefix and records owner, Todo, content type and size
- [ ] Upload rejects a Todo the user does not own, non-image content types and oversize files
- [ ] Read returns the file only to its owner; there is no public URL
- [ ] Tests cover upload, owner read, and another user's refused read
- [ ] The project brief records that the interface awaits a frame
