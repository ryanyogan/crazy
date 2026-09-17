# 14 — Metrics screen: how you actually work

**What to build:** Ryan opens Metrics and switches between Week, 30 days and Quarter. He sees headline figures with their change, focus hours by hour of day, backlog ageing, where his Todos come from, and the 30-day completion heatmap. Simple figures are computed from back-dated seeded Todos; modelled figures and the commentary are seeded snapshots.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** ready-for-agent

- [ ] Seed includes back-dated Todos sufficient for the computed figures
- [ ] Backlog ageing and Todo sources are computed by indexed queries (read-model test)
- [ ] Modelled figures come from snapshot rows keyed by range
- [ ] Switching range changes the data without a full page load and is reflected in the URL
- [ ] Adds the stat tile primitive
- [ ] Visual diff against frame 1f is noise-only at 1180px; the 390px layout is listed as derived
