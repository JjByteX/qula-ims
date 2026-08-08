import type { ProjectDocument } from "@/db/schema";
import { formatDocumentDate, formatPesoAmount } from "@/lib/documents/format";
import styles from "./document.module.css";

export function InvoiceView({ document }: { document: ProjectDocument }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>INVOICE</h1>

      {/* Billed To / Attention (docs/phases-plan-revision-2.md Phase 13)
          sits directly under the document title now, ahead of the
          invoice's own meta block — the client being billed is the
          first thing on the page, like a letterhead's "To:" line, not a
          row inside the payment table below. */}
      <div className={styles.billedToBlock}>
        <div className={styles.metaLabel}>Billed To</div>
        <div>{document.billedToName}</div>
        {document.billedToAttention && <div>Attention: {document.billedToAttention}</div>}
      </div>

      <div className={styles.metaBlock}>
        <div>
          <span className={styles.metaLabel}>Invoice No.: </span>
          <span className={styles.metaValue}>{document.documentNumber}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>Date: </span>
          <span className={styles.metaValue}>
            {document.documentDate ? formatDocumentDate(document.documentDate) : ""}
          </span>
        </div>
        <div>
          <span className={styles.metaLabel}>Due Date: </span>
          <span className={styles.metaValue}>
            {document.dueDate ? formatDocumentDate(document.dueDate) : ""}
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
            <td>Amount Due</td>
            <td>
              ₱{formatPesoAmount(document.amount ?? "0")} ({document.amountInWords})
            </td>
          </tr>
          <tr>
            <td>Payment Purpose</td>
            <td>{document.paymentPurpose}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.sectionLabel}>Reference</div>
      <p className={styles.bodyText}>
        This invoice is issued under the Agreement dated{" "}
        {document.agreementDate ? formatDocumentDate(document.agreementDate) : ""}, total
        project investment ₱{formatPesoAmount(document.totalProjectCost ?? "0")}. Payment
        terms follow that Agreement.
      </p>

      <div className={styles.sectionLabel}>Payment Instructions</div>
      <table className={styles.table}>
        <tbody>
          <tr>
            <td>Method</td>
            <td>{document.paymentMethod}</td>
          </tr>
          <tr>
            <td>Account Name</td>
            <td>{document.paymentAccountName}</td>
          </tr>
          <tr>
            <td>Bank</td>
            <td>{document.paymentBank}</td>
          </tr>
          <tr>
            <td>Account Number</td>
            <td>{document.paymentAccountNumber}</td>
          </tr>
          <tr>
            <td>QR Code</td>
            <td>
              <div className={styles.qrBox}>
                {document.qrCodeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={document.qrCodeUrl} alt="Payment QR code" className={styles.qrImage} />
                ) : (
                  <span className={styles.noPrint}>No QR code uploaded yet.</span>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <p className={styles.bodyText}>
        Payment is received by {document.paymentAccountName} on behalf of the Service
        Providers named in the Agreement.
      </p>

      <p className={styles.bodyText}>
        Issued By:
        <br />
        {document.issuedBy}
      </p>

      {/* Signature (docs/phases-plan-revision-1.md Phase 12.4) — the
          designated payer's signature image at the time this invoice
          was created, snapshotted onto document.signatureUrl so a later
          payer change or profile edit can't alter a document that
          already went out. No fallback text when absent (unlike the QR
          box above): an invoice created before any payer had a
          signature on file, or before Phase 12 existed at all, simply
          has no signature line rather than a placeholder that implies
          one should be there. */}
      {document.signatureUrl && (
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={document.signatureUrl} alt="Signature" className={styles.qrImage} />
        </div>
      )}

      <p className={styles.footerText}>
        Thank you for your trust and confidence. This invoice is a request for payment and is
        not an Official Receipt for tax purposes.
      </p>
    </div>
  );
}
