import { describe, expect, it } from "vitest";
import {
  cloneMapperConfig,
  DEFAULT_MAPPER_CONFIG,
  pruneUnusedCustomMappings,
} from "./mapper-config.js";

describe("pruneUnusedCustomMappings", () => {
  it("removes custom mappings for inactive extension parameters", () => {
    const config = cloneMapperConfig(DEFAULT_MAPPER_CONFIG);
    config.vmc.customParams = { tailWag: "ParamTail", earAngle: "ParamEar" };
    config.vmc.customTransforms = { tailWag: "identity", earAngle: "centered" };

    const pruned = pruneUnusedCustomMappings(config, ["tailWag"]);

    expect(pruned.vmc.customParams).toEqual({ tailWag: "ParamTail" });
    expect(pruned.vmc.customTransforms).toEqual({ tailWag: "identity" });
  });
});
