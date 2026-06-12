# VMC Mapping

PuppetFlow sends blend shape values using the VMC OSC address:

```text
/VMC/Ext/Blend/Val
```

Arguments:

1. Blend shape parameter name (string)
2. Value (float, 0.0–1.0)

Default target: `127.0.0.1:39539`

## Default mapping

See `packages/adapter-vmc/mappings/default.json`.

Parameter names do not need to match your viewer exactly. Edit the mapping file to fit your model or viewer.

## Manual test

1. Start nijiexpose or another VMC receiver on port `39539`
2. Run Playground or the minimal example
3. Move the **Interest** slider and confirm the mapped blend shape changes
