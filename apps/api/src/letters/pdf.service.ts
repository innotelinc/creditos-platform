import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

@Injectable()
export class PdfService {
  renderLetter(input: { title: string; body: string; clientName: string; clientEmail: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "LETTER", margins: { top: 60, bottom: 60, left: 60, right: 60 } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Branded header
      doc.fillColor("#312e81").fontSize(18).font("Helvetica-Bold").text("CreditOS", { continued: false });
      doc.moveDown(0.4);
      doc.fillColor("#6366f1").fontSize(9).font("Helvetica").text("AI Credit Repair Operating System");
      doc.moveDown(0.6);
      doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor("#e0e7ff").lineWidth(1).stroke();
      doc.moveDown(1);

      doc.fillColor("#111827").fontSize(13).font("Helvetica-Bold").text(input.title);
      doc.moveDown(1.2);

      doc.fillColor("#1f2937").fontSize(10.5).font("Helvetica");
      const paragraphs = input.body.split(/\n{2,}/);
      for (const p of paragraphs) {
        doc.text(p.replace(/\n/g, " "), { lineGap: 2 });
        doc.moveDown(0.6);
      }

      doc.moveDown(2);
      doc.font("Helvetica").fontSize(8.5).fillColor("#6b7280").text(
        "CreditOS is a documentation and dispute-tracking platform. It is not a law firm and does not provide legal advice.",
      );

      doc.end();
    });
  }
}
