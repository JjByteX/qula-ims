"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  arDocumentSchema,
  invoiceDocumentSchema,
  type ArDocumentInput,
  type InvoiceDocumentInput,
} from "@/lib/validation/documents";

// Shared field set for both AR and invoice create/edit — the two schemas
// diverge (phases-plan 3.2 field lists), so this renders the right group
// of fields based on `type` while keeping one form shell, matching the
// ProjectForm pattern in app/projects/projects-section.tsx.
type DocumentFormValues = ArDocumentInput &
  Partial<InvoiceDocumentInput> & {
    title?: string;
    milestone?: string;
    price?: string;
  };

function Field({
  id,
  label,
  error,
  ...inputProps
}: {
  id: string;
  label: string;
  error?: string;
} & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} {...inputProps} />
      {error && <p className="text-[var(--text-sm)] text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

export function DocumentForm({
  type,
  defaultValues,
  onSubmit,
  submitLabel,
  showPrefillFields = false,
}: {
  type: "ar" | "invoice";
  defaultValues: DocumentFormValues;
  onSubmit: (
    data: (ArDocumentInput | InvoiceDocumentInput) & {
      title?: string;
      milestone?: string;
      price?: string;
    },
  ) => Promise<void>;
  submitLabel: string;
  // Prefill logic (phases-plan 3.3): title/milestone/price come from the
  // project and are shown editable only when creating. Once a document
  // exists, its title/milestone/price are fixed at issue time — editing
  // them afterward isn't part of 3.3 and would blur what the document
  // says it was issued for, so the edit page never sets this.
  showPrefillFields?: boolean;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = type === "ar" ? arDocumentSchema : invoiceDocumentSchema;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(schema as never),
    mode: "onChange",
    defaultValues,
  });

  async function submit(data: DocumentFormValues) {
    setServerError(null);
    try {
      // title/milestone/price ride along as extra keys the zod resolver
      // doesn't validate (registered directly below); onSubmit's caller
      // decides whether to use them (create) or the payload just won't
      // include meaningful values for them (edit, since the fields never
      // render and stay undefined).
      await onSubmit(data as (ArDocumentInput | InvoiceDocumentInput) & {
        title?: string;
        milestone?: string;
        price?: string;
      });
    } catch {
      setServerError("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      {showPrefillFields && (
        <div className="flex flex-col gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--muted)] p-4">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Prefilled from the project — edit if this document needs different wording
          </span>
          <Field
            id="title"
            label="Project / Title"
            error={undefined}
            {...register("title" as keyof DocumentFormValues)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="milestone"
              label="Milestone"
              error={undefined}
              {...register("milestone" as keyof DocumentFormValues)}
            />
            <Field
              id="price"
              label="Project Price"
              error={undefined}
              {...register("price" as keyof DocumentFormValues)}
            />
          </div>
        </div>
      )}

      <Field
        id="documentNumber"
        label={type === "ar" ? "Receipt No." : "Invoice No."}
        error={errors.documentNumber?.message}
        {...register("documentNumber")}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          id="documentDate"
          label="Date"
          type="date"
          error={errors.documentDate?.message}
          {...register("documentDate")}
        />
        {type === "invoice" && (
          <Field
            id="dueDate"
            label="Due Date"
            type="date"
            error={(errors as Record<string, { message?: string }>).dueDate?.message}
            {...register("dueDate" as keyof DocumentFormValues)}
          />
        )}
      </div>

      {type === "ar" ? (
        <>
          <Field
            id="receivedFromName"
            label="Received From (company)"
            error={errors.receivedFromName?.message}
            {...register("receivedFromName")}
          />
          <Field
            id="receivedFromAttention"
            label="Attention (contact person)"
            error={errors.receivedFromAttention?.message}
            {...register("receivedFromAttention")}
          />
        </>
      ) : (
        <>
          <Field
            id="billedToName"
            label="Billed To (company)"
            error={(errors as Record<string, { message?: string }>).billedToName?.message}
            {...register("billedToName" as keyof DocumentFormValues)}
          />
          <Field
            id="billedToAttention"
            label="Attention (contact person)"
            error={(errors as Record<string, { message?: string }>).billedToAttention?.message}
            {...register("billedToAttention" as keyof DocumentFormValues)}
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          id="amount"
          label={type === "ar" ? "Amount Received" : "Amount Due"}
          error={errors.amount?.message}
          {...register("amount")}
        />
        <Field
          id="amountInWords"
          label="Amount In Words"
          error={errors.amountInWords?.message}
          {...register("amountInWords")}
        />
      </div>

      <Field
        id="paymentPurpose"
        label="Payment Purpose"
        error={errors.paymentPurpose?.message}
        {...register("paymentPurpose")}
      />

      {type === "ar" ? (
        <>
          <Field
            id="remainingBalance"
            label="Remaining Balance"
            error={errors.remainingBalance?.message}
            {...register("remainingBalance")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="receivedByName"
              label="Received By"
              error={errors.receivedByName?.message}
              {...register("receivedByName")}
            />
            <Field
              id="receivedByTitle"
              label="Title"
              error={errors.receivedByTitle?.message}
              {...register("receivedByTitle")}
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="agreementDate"
              label="Agreement Date"
              type="date"
              error={(errors as Record<string, { message?: string }>).agreementDate?.message}
              {...register("agreementDate" as keyof DocumentFormValues)}
            />
            <Field
              id="totalProjectCost"
              label="Total Project Cost"
              error={(errors as Record<string, { message?: string }>).totalProjectCost?.message}
              {...register("totalProjectCost" as keyof DocumentFormValues)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="paymentMethod"
              label="Payment Method"
              error={(errors as Record<string, { message?: string }>).paymentMethod?.message}
              {...register("paymentMethod" as keyof DocumentFormValues)}
            />
            <Field
              id="paymentAccountName"
              label="Account Name"
              error={(errors as Record<string, { message?: string }>).paymentAccountName?.message}
              {...register("paymentAccountName" as keyof DocumentFormValues)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="paymentBank"
              label="Bank"
              error={(errors as Record<string, { message?: string }>).paymentBank?.message}
              {...register("paymentBank" as keyof DocumentFormValues)}
            />
            <Field
              id="paymentAccountNumber"
              label="Account Number"
              error={
                (errors as Record<string, { message?: string }>).paymentAccountNumber?.message
              }
              {...register("paymentAccountNumber" as keyof DocumentFormValues)}
            />
          </div>
          <Field
            id="issuedBy"
            label="Issued By"
            error={(errors as Record<string, { message?: string }>).issuedBy?.message}
            {...register("issuedBy" as keyof DocumentFormValues)}
          />
        </>
      )}

      {serverError && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
