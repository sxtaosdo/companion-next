# Tool preset bounded real acceptance — 2026-10-19

Checkpoint before fixture writes. Reuse the real CRUD, single import, export and in-use deletion protection recorded in remaining-real-acceptance-20261018.md.

Pending: import two unique temporary presets with enabled/disabled overrides through Next; export/read back; assign only fixture a79f4915296f4091; compare the existing MCP connection snapshot with a fresh CLI stdio connection. Use initialize/tools/list only. Restore the implicit fixture selection and remove only the two owned presets. Preserve all other selections, installed runtime and shared source changes.

No IDE configuration, model/Creator action, host lifecycle change, service restart or deployment is authorized in this acceptance. Creator child cleanup implementation remains awaiting user confirmation.
