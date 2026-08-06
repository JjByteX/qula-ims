import type { ProjectDocument } from "@/db/schema";
import { formatDocumentDate, formatPesoAmount } from "@/lib/documents/format";
import styles from "./document.module.css";

export function InvoiceView({ document }: { document: ProjectDocument }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>INVOICE</h1>

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
            <td>Billed To</td>
            <td>
              {document.billedToName}
              {document.billedToAttention && (
                <>
                  <br />
                  Attention: {document.billedToAttention}
                </>
              )}
            </td>
          </tr>
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
            <td>Reference/Note to include</td>
            <td>{document.paymentReferenceNote}</td>
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

      <p className={styles.footerText}>
        Thank you for your trust and confidence. This invoice is a request for payment and is
        not an Official Receipt for tax purposes.
      </p>
    </div>
  );
}
