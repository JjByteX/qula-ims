import type { ProjectDocument } from "@/db/schema";
import { formatDocumentDate, formatPesoAmount } from "@/lib/documents/format";
import styles from "./document.module.css";

export function AcknowledgementReceiptView({ document }: { document: ProjectDocument }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>ACKNOWLEDGEMENT RECEIPT</h1>

      {/* Received From / Attention (docs/phases-plan-revision-2.md Phase
          13) sits directly under the document title now, ahead of the
          receipt's own meta block — same reasoning and layout as the
          matching Billed To block on invoice-view.tsx. */}
      <div className={styles.billedToBlock}>
        <div className={styles.metaLabel}>Received From</div>
        <div>{document.receivedFromName}</div>
        {document.receivedFromAttention && (
          <div>Attention: {document.receivedFromAttention}</div>
        )}
      </div>

      <div className={styles.metaBlock}>
        <div>
          <span className={styles.metaLabel}>Receipt No.: </span>
          <span className={styles.metaValue}>{document.documentNumber}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>Date: </span>
          <span className={styles.metaValue}>
            {document.documentDate ? formatDocumentDate(document.documentDate) : ""}
          </span>
        </div>
      </div>

      <table className={styles.table}>
        <tbody>
          <tr>
            <td>Project</td>
            <td>{document.title}</td>
          </tr>
          <tr>
            <td>Amount Received</td>
            <td>
              ₱{formatPesoAmount(document.amount ?? "0")} ({document.amountInWords})
            </td>
          </tr>
          <tr>
            <td>Payment Purpose</td>
            <td>{document.paymentPurpose}</td>
          </tr>
          <tr>
            <td>Remaining Balance</td>
            <td>₱{formatPesoAmount(document.remainingBalance ?? "0")}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.sectionLabel}>Acknowledgement</div>
      <p className={styles.bodyText}>
        We hereby acknowledge receipt of {document.amountInWords} (₱
        {formatPesoAmount(document.amount ?? "0")}) from {document.receivedFromName} as
        payment for the {document.title}. This payment corresponds to {document.paymentPurpose}{" "}
        under the agreed total project investment of ₱{formatPesoAmount(document.price)}.
      </p>

      <table className={styles.signatureTable}>
        <tbody>
          <tr>
            <td>
              {/* Signature (docs/phases-plan-revision-2.md Phase 16) —
                  the designated payer's signature image, snapshotted
                  onto document.receivedBySignatureUrl at creation/
                  refresh time so a later payer change or profile edit
                  can't alter a document that already went out. Shown
                  above the printed signature line rather than replacing
                  it — same qrImage sizing as the invoice's signature
                  block, just constrained to this table cell's width.
                  No fallback when absent: an AR created before any
                  payer had a signature on file, or before Phase 16
                  existed, simply shows the blank line for a hand
                  signature, same as always. Only this side (the payer)
                  gets an image — the client's signature (right column)
                  is always in-person, never a stored image. */}
              {document.receivedBySignatureUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={document.receivedBySignatureUrl}
                  alt="Signature"
                  className={styles.qrImage}
                />
              )}
              {document.receivedByName}
              <br />
              {document.receivedByTitle}
              <div className={styles.signatureLine}>Signature</div>
            </td>
            <td>
              {document.receivedFromName}
              {document.receivedFromAttention && <>, {document.receivedFromAttention}</>}
              <div className={styles.signatureLine}>Signature</div>
            </td>
          </tr>
        </tbody>
      </table>

      <p className={styles.footerText}>
        Thank you for your trust and confidence. We look forward to delivering the project
        according to the agreed scope and timeline. This acknowledgement receipt is issued
        only to confirm receipt of payment and is not an Official Receipt for tax purpose.
      </p>
    </div>
  );
}
