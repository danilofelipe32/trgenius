import { SavedDocument, Section } from '../types';

declare const jspdf: any;

export const exportDocumentToPDF = (doc: SavedDocument, sections: Section[]) => {
    const { jsPDF } = jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');

    const pageMargin = 50;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (pageMargin * 2);
    let yPos = pageMargin;

    const addHeader = (title: string) => {
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100);
        pdf.text(title, pageMargin, pageMargin - 20);
        pdf.setDrawColor(200);
        pdf.line(pageMargin, pageMargin - 15, pageWidth - pageMargin, pageMargin - 15);
    };

    const addFooter = (pageNumber: number, totalPages: number) => {
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        const footerText = `Gerado por TR Genius PWA | Autor: Danilo Arruda | Página ${pageNumber} de ${totalPages}`;
        const textWidth = pdf.getStringUnitWidth(footerText) * pdf.internal.getFontSize() / pdf.internal.scaleFactor;
        pdf.setDrawColor(200);
        pdf.line(pageMargin, pageHeight - pageMargin + 15, pageWidth - pageMargin, pageHeight - pageMargin + 15);
        pdf.text(footerText, (pageWidth - textWidth) / 2, pageHeight - pageMargin + 30);
    };

    const addText = (text: string, options: { size: number; isBold?: boolean; spacing?: number; x?: number; color?: number | string; }) => {
        pdf.setFontSize(options.size);
        pdf.setFont(undefined, options.isBold ? 'bold' : 'normal');
        if (options.color) {
            pdf.setTextColor(options.color);
        } else {
            pdf.setTextColor(50); // Default text color
        }

        const splitText = pdf.splitTextToSize(text, contentWidth);
        const textBlockHeight = pdf.getTextDimensions(splitText).h;

        if (yPos + textBlockHeight > pageHeight - pageMargin) {
            pdf.addPage();
            yPos = pageMargin;
            addHeader(doc.name);
        }

        pdf.text(splitText, options.x || pageMargin, yPos);
        yPos += textBlockHeight + (options.spacing || 0);
    };

    // --- Title Page ---
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(40, 52, 71); // Dark blue-gray
    pdf.text(doc.name, pageWidth / 2, pageHeight / 3, { align: 'center' });

    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100);

    const metadataYStart = pageHeight / 3 + 60;
    const creationDate = `Criado em: ${new Date(doc.createdAt).toLocaleString('pt-BR')}`;
    pdf.text(creationDate, pageWidth / 2, metadataYStart, { align: 'center' });
    
    if (doc.updatedAt && doc.updatedAt !== doc.createdAt) {
        const updatedDate = `Atualizado em: ${new Date(doc.updatedAt).toLocaleString('pt-BR')}`;
        pdf.text(updatedDate, pageWidth / 2, metadataYStart + 20, { align: 'center' });
    }
    
    const authorText = "Autor do Documento: Danilo Arruda";
    pdf.text(authorText, pageWidth / 2, metadataYStart + 40, { align: 'center' });
    
    pdf.text("Ferramenta: TR Genius PWA", pageWidth / 2, metadataYStart + 60, { align: 'center' });
    
    // --- Content Pages ---
    pdf.addPage();
    yPos = pageMargin;
    addHeader(doc.name);

    sections.forEach(section => {
        const content = doc.sections[section.id];
        if (content && String(content).trim()) {
            addText(section.title, { size: 14, isBold: true, spacing: 10, color: '#1e293b' }); // slate-800
            addText(String(content), { size: 11, spacing: 25, color: '#334155' }); // slate-700
        }
    });

    if (doc.attachments && doc.attachments.length > 0) {
        yPos += 10;
        if (yPos > pageHeight - pageMargin) {
            pdf.addPage();
            yPos = pageMargin;
            addHeader(doc.name);
        }
        
        addText('Anexos:', { size: 14, isBold: true, spacing: 10, color: '#1e293b' });

        doc.attachments.forEach(att => {
            let attachmentText = `- ${att.name} (${att.type})`;
            if (att.description) {
              attachmentText += `\n  Descrição: ${att.description}`;
            }
            addText(attachmentText, { size: 11, spacing: 10, color: '#334155' });
        });
    }

    // --- Final Step: Add Footers to all pages ---
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        addFooter(i, pageCount);
    }

    pdf.save(`${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};