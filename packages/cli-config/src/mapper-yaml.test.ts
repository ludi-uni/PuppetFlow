import { describe, expect, it } from "vitest";
import {
  getDefaultProfile,
  profileToParamNames,
  profileToTransforms,
} from "@puppetflow/motion-mapper";

import {
  exportCustomMappingsYaml,
  parseOscAdapterYamlConfig,
  sparseMotionParams,
  studioOscMapperToYamlForTarget,
  type StudioOscMapperModel,
} from "./mapper-yaml.js";
import { yamlConfigToLaunchConfig } from "./parse.js";

function createStudioMapperModel(
  overrides: Partial<StudioOscMapperModel> = {},
): StudioOscMapperModel {
  const profile = getDefaultProfile("vmc");
  return {
    enabled: true,
    host: "127.0.0.1",
    port: 39539,
    params: profileToParamNames(profile),
    transforms: profileToTransforms(profile),
    customParams: {},
    customTransforms: {},
    ...overrides,
  };
}

describe("mapper-yaml", () => {
  it("exports sparse params and non-default transforms", () => {
    const yaml = studioOscMapperToYamlForTarget(
      "vmc",
      createStudioMapperModel({
        params: {
          ...profileToParamNames(getDefaultProfile("vmc")),
          mouthX: "CustomJaw",
        },
        transforms: {
          ...profileToTransforms(getDefaultProfile("vmc")),
          mouthX: "invert",
        },
      }),
    );

    expect(yaml.params?.mouthX).toBe("CustomJaw");
    expect(yaml.transforms?.mouthX).toBe("invert");
    expect(yaml.transforms?.lookX).toBeUndefined();
  });

  it("exports custom mappings", () => {
    const custom = exportCustomMappingsYaml(
      { MouthA: "ParamMouthA" },
      { MouthA: "centered" },
    );

    expect(custom).toEqual({
      MouthA: { param: "ParamMouthA", transform: "centered" },
    });
  });

  it("parses v2 adapter mapper fields into launch config", () => {
    const parsed = parseOscAdapterYamlConfig(
      "vmc",
      {
        enabled: true,
        host: "127.0.0.1",
        port: 39539,
        params: {
          mouthX: "Jaw",
          lookX: "EyeX",
        },
        transforms: {
          lookX: "centered",
        },
        custom: {
          MouthA: { param: "ParamMouthA" },
        },
      },
      "adapters.vmc",
    );

    const launch = yamlConfigToLaunchConfig(
      {
        version: 2,
        presetName: "Curious",
        adapters: { vmc: parsed },
      },
      "{}",
    );

    expect(launch.adapters?.vmc?.params?.mouthX).toBe("Jaw");
    expect(launch.adapters?.vmc?.transforms?.lookX).toBe("centered");
    expect(launch.adapters?.vmc?.custom?.MouthA).toEqual({ param: "ParamMouthA" });
  });

  it("ignores transforms for unmapped standard keys", () => {
    const parsed = parseOscAdapterYamlConfig(
      "vmc",
      {
        params: { mouthX: "Jaw" },
        transforms: { lookX: "centered" },
      },
      "adapters.vmc",
    );

    expect(parsed?.transforms).toBeUndefined();
  });

  it("sparseMotionParams skips empty strings", () => {
    const profile = getDefaultProfile("vmc");
    const params = profileToParamNames(profile);
    params.mouthX = "";

    expect(sparseMotionParams(params)?.mouthX).toBeUndefined();
  });
});
