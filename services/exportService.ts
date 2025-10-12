import { SavedDocument, Section } from '../types';

declare const jspdf: any;

export const exportDocumentToPDF = (doc: SavedDocument, sections: Section[]) => {
    const { jsPDF } = jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');

    const pageMargin = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (pageMargin * 2);
    let yPos = pageMargin;

    const addText = (text: string, options: { size: number; isBold?: boolean; spacing?: number; x?: number }) => {
        pdf.setFontSize(options.size);
        pdf.setFont(undefined, options.isBold ? 'bold' : 'normal');

        const splitText = pdf.splitTextToSize(text, contentWidth);
        const textBlockHeight = pdf.getTextDimensions(splitText).h;

        if (yPos + textBlockHeight > pageHeight - pageMargin) {
            pdf.addPage();
            yPos = pageMargin;
        }

        pdf.text(splitText, options.x || pageMargin, yPos);
        yPos += textBlockHeight + (options.spacing || 0);
    };
    
    addText(doc.name, { size: 18, isBold: true, spacing: 5 });
    
    const creationDate = `Criado em: ${new Date(doc.createdAt).toLocaleString('pt-BR')}`;
    addText(creationDate, { size: 9, spacing: 20 });
    
    pdf.setLineWidth(0.5);
    pdf.line(pageMargin, yPos, pageWidth - pageMargin, yPos);
    yPos += 15;

    sections.forEach(section => {
        const content = doc.sections[section.id];
        if (content && content.trim()) {
            addText(section.title, { size: 14, isBold: true, spacing: 10 });
            addText(content, { size: 11, spacing: 20 });
        }
    });

    if (doc.attachments && doc.attachments.length > 0) {
        yPos += 10;
        if (yPos > pageHeight - pageMargin) {
            pdf.addPage();
            yPos = pageMargin;
        }
        pdf.setLineWidth(0.5);
        pdf.line(pageMargin, yPos, pageWidth - pageMargin, yPos);
        yPos += 15;

        addText('Anexos:', { size: 14, isBold: true, spacing: 10 });

        doc.attachments.forEach(att => {
            addText(`- ${att.name} (${att.type})`, { size: 11, spacing: 5 });
        });
    }

    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(
            `Página ${i} de ${pageCount}`,
            pageWidth / 2,
            pageHeight - 20,
            { align: 'center' }
        );
    }

    pdf.save(`${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};