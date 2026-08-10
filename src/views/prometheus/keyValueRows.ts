import { ref, type Ref } from "vue";

export interface KeyValueRow {
  key: string;
  value: string;
}

export const KV_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function createEmptyKvRow(): KeyValueRow {
  return { key: "", value: "" };
}

export function recordToRows(
  record: Record<string, string | number | boolean> | undefined
): KeyValueRow[] {
  const entries = Object.entries(record || {});
  if (!entries.length) {
    return [createEmptyKvRow()];
  }
  return entries.map(([key, value]) => ({
    key,
    value: String(value ?? "")
  }));
}

export function buildRecordFromRows(
  rows: KeyValueRow[],
  options: {
    fieldName: string;
    required?: boolean;
    allowEmpty?: boolean;
  }
): Record<string, string> {
  const { fieldName, required = false, allowEmpty = true } = options;
  const normalized = rows
    .map(row => ({ key: row.key.trim(), value: row.value.trim() }))
    .filter(row => row.key || row.value);

  for (const row of normalized) {
    if (!row.key) {
      throw new Error(`${fieldName} Key 不能为空.`);
    }
    if (!KV_KEY_PATTERN.test(row.key)) {
      throw new Error(
        `${fieldName} Key「${row.key}」格式不正确，仅支持字母、数字、下划线，且不能以数字开头。`
      );
    }
  }

  const keys = normalized.map(row => row.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${fieldName} Key 不能重复.`);
  }

  if (!normalized.length) {
    if (required) {
      throw new Error(`请至少添加一个${fieldName}.`);
    }
    if (allowEmpty) {
      return {};
    }
  }

  return Object.fromEntries(normalized.map(row => [row.key, row.value]));
}

export function useKeyValueRows(options: {
  fieldName: string;
  required?: boolean;
  allowEmpty?: boolean;
  initial?: Record<string, string | number | boolean>;
}) {
  const rows: Ref<KeyValueRow[]> = ref(recordToRows(options.initial));

  const setFromRecord = (
    record: Record<string, string | number | boolean> | undefined
  ) => {
    rows.value = recordToRows(record);
  };

  const resetRows = (
    record: Record<string, string | number | boolean> | undefined = {}
  ) => {
    setFromRecord(record);
  };

  const addRow = () => {
    rows.value.push(createEmptyKvRow());
  };

  const removeRow = (index: number) => {
    if (rows.value.length <= 1) {
      rows.value[0] = createEmptyKvRow();
      return;
    }
    rows.value.splice(index, 1);
  };

  const build = () =>
    buildRecordFromRows(rows.value, {
      fieldName: options.fieldName,
      required: options.required,
      allowEmpty: options.allowEmpty
    });

  return { rows, setFromRecord, resetRows, addRow, removeRow, build };
}
