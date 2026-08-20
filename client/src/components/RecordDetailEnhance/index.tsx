import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { t } from "i18next";
import { Button, DropdownRef } from "@imbrace/ui";
import {
  Dropdown,
  Icon,
  Illustration,
  Space,
  Typography,
  useDialog,
} from "@imbrace/ui";
import { Tooltip } from "@mui/material";
import dayjs from "dayjs";
import SimpleBar from "simplebar-react";
import { AttachmentValue } from "@/components/FlexibleTable/types";
import Attachment from "@/components/FlexibleTable/attachment";
import EditableColumn from "./editableColumn";
import Notes from "./Notes";
import styles from "./index.module.scss";

export interface RecordDetailProps {
  board?: API.Board;
  record?: API.BoardItem;
  refresh: () => Promise<void>;
  inModal?: boolean;
  readOnly?: boolean;
}

export type RecordValue = API.RecordValue | AttachmentValue[];

export const FieldTypeIcon = (
  type: API.FieldType,
  props?: Omit<IconProps, "name" | "namespace">
) => {
  switch (type) {
    case "Date":
      return <Icon name="date" {...props} />;
    case "ShortText":
      return <Icon name="shortText" {...props} />;
    case "LongText":
      return <Icon name="longText" {...props} />;
    case "SingleSelection":
      return <Icon name="singleSelection" {...props} />;
    case "MultipleSelection":
      return <Icon name="multipleSelection" {...props} />;
    case "Number":
      return <Icon name="numberSign" {...props} />;
    case "Email":
      return <Icon name="emailOutline" {...props} />;
    case "Phone":
      return <Icon name="call" {...props} />;
    case "Link":
      return <Icon name="linkSide" {...props} />;
    case "Priority":
      return <Icon name="priority" {...props} />;
    case "Assignee":
      return <Icon name="assignee" {...props} />;
    case "MultipleAssignee":
      return <Icon name="assignee" {...props} />;
    case "Datetime":
      return <Icon name="calendar" {...props} />;
    case "Country":
      return <Icon name="country" {...props} />;
    case "Attachment":
      return <Icon name="attachment" {...props} />;
    case "Origin":
      return <Icon name="mindMap" {...props} />;
    case "Time":
      return <Icon name="timeClock" {...props} />;
    case "RichText":
      return <Icon name="richText" {...props} />;
    case "Notes":
      return <Icon name="notes" {...props} />;
    case "Currency":
      return <Icon name="currency" {...props} />;
    case "Checkbox":
      return <Icon name="checkbox" {...props} />;
    default:
      return <Icon name="help" {...props} />;
  }
};

const EditableField = ({
  field,
  record,
  value,
  onDataUpdate,
  readOnly,
}: {
  field: API.BoardField;
  record: API.BoardItem;
  value: RecordValue;
  onDataUpdate: (data: {
    fieldId: string;
    value: RecordValue;
    recordId: string;
  }) => Promise<void>;
  readOnly?: boolean;
}) => {
  const { type, name, _id } = field;
  const valueEnum = field.data?.reduce((prev, current) => {
    return {
      ...prev,
      [current["_id"]]: current["value"],
    };
  }, {});

  if (type === "Notes") {
    return (
      <Notes
        fieldName={name}
        bordered
        containerStyle={{ width: "100%" }}
        notes={value as API.NotesValue[]}
        onChange={(notes) => {}}
        readOnly={readOnly || false}
      />
    );
  }

  if (type === "Attachment") {
    const maxAttachment = 10;
    return (
      <Space
        key={_id}
        size={4}
        direction="vertical"
        align="start"
        style={{ width: "100%", marginBottom: "16px" }}
      >
        <Space
          justify="between"
          size={8}
          style={{ color: "var(--color-light-5)", fontSize: 20, width: "100%" }}
        >
          <Space>
            {FieldTypeIcon(type)}
            <Typography
              variant="BodyTight"
              style={{ color: "var(--color-light-5)" }}
            >
              {name}
            </Typography>
          </Space>
          <div>
            <Tooltip
              title={t("error_max_attach_files", { max: maxAttachment })}
              disableHoverListener={
                (value ? (value as AttachmentValue[]) : []).length <
                maxAttachment
              }
              placement="top-start"
              arrow
            >
              <span>
                <Button
                  variant="link"
                  startIcon={<Icon name="add" />}
                  disabled={
                    (value ? (value as AttachmentValue[]) : []).length >=
                      maxAttachment ||
                    readOnly ||
                    false
                  }
                  text="Upload Documents"
                  size="s"
                  type="primary"
                  sx={{ fontWeight: "400" }}
                />
              </span>
            </Tooltip>
          </div>
        </Space>
        <Space
          size={4}
          direction="vertical"
          align="start"
          style={{ width: "100%", paddingLeft: "12px", paddingTop: "10px" }}
        >
          <Attachment
            value={value as AttachmentValue[]}
            fieldId={_id}
            onUpdate={async (newValue?: AttachmentValue[]) => {}}
          />
        </Space>
      </Space>
    );
  }

  return (
    <>
      <Space
        key={_id}
        size={4}
        direction="vertical"
        align="start"
        style={{ width: "100%" }}
      >
        <Space size={8} style={{ color: "var(--color-light-5)", fontSize: 20 }}>
          {FieldTypeIcon(type)}
          <Typography
            variant="BodyTight"
            style={{ color: "var(--color-light-5)" }}
          >
            {name}
          </Typography>
        </Space>
        <EditableColumn
          fieldType={type}
          value={value as API.RecordValue}
          meta={{
            defaultFieldName: field.default_field_name,
            defaultCountryCode: field.settings?.default_country_code,
            defaultCurrencyCode: field.settings?.default_currency_code,
          }}
          {...((type === "SingleSelection" ||
            type === "MultipleSelection" ||
            type === "Priority") && {
            dataEnum: valueEnum,
          })}
          record={record}
          fieldId={_id}
          editable={type !== "RichText"}
          {...(field?.default_field_name === "stage" && {
            disabled: () => {
              return record.fields[field._id] === "Unidentified Lead";
            },
            disabledTooltip: t("crm_field_stage_disabled_desc"),
          })}
          {...(field?.default_field_name === "created_at" && {
            disabled: () => {
              return record.created_type === "system";
            },
            disabledTooltip: t("crm_system_data_disabled_edit_desc"),
          })}
          {...(field?.default_field_name === "birthday" && {
            minDate: dayjs(new Date(0)),
          })}
          {...(type === "ShortText" && {
            validate: (newValue?: unknown) => {
              const target = newValue as string;
              if (target && target.length > 150) {
                return t("crm_field_short_text_length_limit");
              }
              return true;
            },
          })}
          {...(field.is_identifier && {
            validate: (newValue?: unknown) => {
              const target = newValue as string;
              if (!target) {
                return t("crm_identifier_can_not_delete");
              }
              if (target && target.length > 150) {
                return t("crm_field_short_text_length_limit");
              }
              return true;
            },
          })}
          updateData={onDataUpdate}
          readonly={readOnly}
        />
      </Space>
    </>
  );
};

export const DetailFields = ({
  board,
  record,
  onDataUpdate,
  readOnly,
  formValues,
}: {
  board: API.Board;
  record: API.BoardItem;
  onDataUpdate: (data: {
    fieldId: string;
    value: RecordValue;
    recordId: string;
  }) => Promise<void>;
  readOnly?: boolean;
  formValues: RecordValue;
}) => {
  const { t } = useTranslation();

  const headerFields = getHeaderFields(board);
  const headerFieldNames = headerFields.fields.map((f) => f.name);

  return (
    <div style={{ flex: 1, width: "100%", overflow: "hidden" }}>
      <SimpleBar style={{ width: "100%", height: "100%" }}>
        <Space size={16} direction="vertical" className={styles["body"] || ""}>
          {board.fields
            .filter((field) => {
              return (
                !field.is_identifier &&
                !field.hidden_on_record &&
                !headerFieldNames.includes(field.name as any)
              );
            })
            .map((field) => {
              const value = formValues
                ? (formValues[
                    field._id as keyof typeof formValues
                  ] as RecordValue)
                : "";
              return (
                <EditableField
                  value={value}
                  field={field}
                  record={record}
                  onDataUpdate={onDataUpdate}
                  readOnly={readOnly || false}
                />
              );
            })}
        </Space>
      </SimpleBar>
    </div>
  );
};

const HEADER_FIELDS = {
  TASK: {
    PRIORITY: "Priority",
    DUE_DATE: "Due Date",
    STATUS: "Status",
    TYPE: "Type",
    ASSIGNEE: "Assignee",
    TASK_OWNER: "Task Owner",
  },
  PRODUCT: {
    UNIT_PRICE: "Unit Price",
    SOLD: "Sold",
    STOCK: "In Stock",
    ID: "ID",
    TAGS: "Tags",
    DESCRIPTION: "Description",
  },
  OPPORTUNITY: {
    PRIORITY: "Priority",
    STAGE: "Stage",
    TYPE: "Type",
    ASSIGNEE: "Assignee",
    OWNER: "Owner",
  },
} as const;

const getHeaderFields = (board: API.Board) => {
  const findField = (name: string) =>
    board?.fields.find((field) => field.name === name && field.is_default);
  switch (board?.type) {
    case "Tasks":
      return {
        fields: Object.values(HEADER_FIELDS.TASK).map((name) => ({
          name,
          field: findField(name),
        })),
        topFields: [
          HEADER_FIELDS.TASK.PRIORITY,
          HEADER_FIELDS.TASK.DUE_DATE,
          HEADER_FIELDS.TASK.STATUS,
          HEADER_FIELDS.TASK.TASK_OWNER,
        ],
        bottomFields: [HEADER_FIELDS.TASK.TYPE, HEADER_FIELDS.TASK.ASSIGNEE],
      };
    case "Products":
      return {
        fields: Object.values(HEADER_FIELDS.PRODUCT).map((name) => ({
          name,
          field: findField(name),
        })),
        topFields: [
          HEADER_FIELDS.PRODUCT.UNIT_PRICE,
          HEADER_FIELDS.PRODUCT.SOLD,
          HEADER_FIELDS.PRODUCT.STOCK,
          HEADER_FIELDS.PRODUCT.ID,
        ],
        bottomFields: [
          HEADER_FIELDS.PRODUCT.TAGS,
          HEADER_FIELDS.PRODUCT.DESCRIPTION,
        ],
      };
    case "Opportunities":
      return {
        fields: Object.values(HEADER_FIELDS.OPPORTUNITY).map((name) => ({
          name,
          field: findField(name),
        })),
        topFields: [
          HEADER_FIELDS.OPPORTUNITY.PRIORITY,
          HEADER_FIELDS.OPPORTUNITY.STAGE,
          HEADER_FIELDS.OPPORTUNITY.OWNER,
        ],
        bottomFields: [
          HEADER_FIELDS.OPPORTUNITY.TYPE,
          HEADER_FIELDS.OPPORTUNITY.ASSIGNEE,
        ],
      };
    default:
      return { fields: [], topFields: [], bottomFields: [] };
  }
};

const RecordDetailEnhance = (props: RecordDetailProps) => {
  const { board, record, refresh, inModal, readOnly } = props;
  const { t } = useTranslation();

  const methods = useForm<Record<string, API.RecordValue>>({
    mode: "all",
    defaultValues: record?.fields || {},
  });

  const {
    control,
    formState: { isDirty, isValid },
    handleSubmit,
    setValue,
    watch,
    reset,
  } = methods;

  useEffect(() => {
    if (record?.fields) {
      reset(record.fields);
    }
  }, [record, reset]);

  const formValues = watch();

  const onDataUpdate = async (data: {
    fieldId: string;
    value: RecordValue;
    recordId: string;
  }) => {
    setValue(data.fieldId, data.value as any, { shouldDirty: true });
  };

  if (!board || !record) {
    return (
      <Illustration
        name="recordMissing2"
        description={t("no_associated_records_found")}
      />
    );
  }

  return (
    <Space
      size={0}
      direction="vertical"
      className={styles["container"] || ""}
      align="stretch"
    >
      <DetailFields
        board={board}
        record={record}
        onDataUpdate={onDataUpdate}
        readOnly={readOnly || false}
        formValues={formValues}
      />
    </Space>
  );
};

export default RecordDetailEnhance;
