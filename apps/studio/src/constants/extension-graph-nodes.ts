import { getBundledMotionRegistry } from "@puppetflow/extension-bundled";
import type { PackConfigField } from "@puppetflow/extension-core";

export interface ExtensionGraphPackOption {
  id: string;
  label: string;
  description?: string;
  configFields: PackConfigField[];
}

export interface ExtensionGraphGeneratorOption {
  id: string;
  label: string;
  description?: string;
  configFields: PackConfigField[];
}

export interface ExtensionGraphCustomNodeOption {
  type: string;
  label: string;
  category?: string;
  configFields: Array<{
    key: string;
    label: string;
    default: number;
    min: number;
    max: number;
    step: number;
  }>;
}

function configFieldsFromPack(
  fields: PackConfigField[] | undefined,
): PackConfigField[] {
  return fields ?? [];
}

export function getExtensionGraphPacks(): ExtensionGraphPackOption[] {
  const registry = getBundledMotionRegistry();
  return [...registry.packs.values()].map((pack) => ({
    id: pack.id,
    label: pack.label,
    description: pack.description,
    configFields: configFieldsFromPack(pack.configFields),
  }));
}

export function getExtensionGraphGenerators(): ExtensionGraphGeneratorOption[] {
  const registry = getBundledMotionRegistry();
  return [...registry.generators.values()].map((generator) => ({
    id: generator.id,
    label: generator.label,
    description: generator.description,
    configFields: configFieldsFromPack(generator.configFields),
  }));
}

export function getExtensionGraphCustomNodes(): ExtensionGraphCustomNodeOption[] {
  const registry = getBundledMotionRegistry();
  return [...registry.nodes.values()].map((node) => ({
    type: node.type,
    label: node.label,
    category: node.category,
    configFields: configFieldsFromPack(node.configFields),
  }));
}

export function defaultMotionPackNodeData(packId: string): Record<string, unknown> {
  const pack = getExtensionGraphPacks().find((entry) => entry.id === packId);
  const data: Record<string, unknown> = {
    label: pack?.label ?? packId,
    packId,
  };
  for (const field of pack?.configFields ?? []) {
    data[field.key] = field.default;
  }
  return data;
}

export function defaultMotionGeneratorNodeData(
  generatorId: string,
): Record<string, unknown> {
  const generator = getExtensionGraphGenerators().find(
    (entry) => entry.id === generatorId,
  );
  const data: Record<string, unknown> = {
    label: generator?.label ?? generatorId,
    generatorId,
  };
  for (const field of generator?.configFields ?? []) {
    data[field.key] = field.default;
  }
  return data;
}

export function defaultExtensionCustomNodeData(
  nodeType: string,
): Record<string, unknown> {
  const node = getExtensionGraphCustomNodes().find((entry) => entry.type === nodeType);
  const data: Record<string, unknown> = {
    label: node?.label ?? nodeType,
  };
  for (const field of node?.configFields ?? []) {
    data[field.key] = field.default;
  }
  return data;
}
