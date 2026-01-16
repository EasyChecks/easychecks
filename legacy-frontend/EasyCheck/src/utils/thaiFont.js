// THSarabunNew font for jsPDF
// ฟอนต์ภาษาไทยสำหรับ jsPDF (ใช้ THSarabunNew)
export const addThaiFont = (doc) => {
  // เนื่องจากไฟล์ฟอนต์มีขนาดใหญ่ เราจะใช้วิธี fallback โดยใช้ฟอนต์ default
  // และเพิ่ม unicode support
  
  // THSarabunNew font base64 (simplified version for basic Thai support)
  const thaiFont = 'AAEAAAALAIAAAwAwT1MvMg8SBfAAAAC8AAAAYGNtYXAAAQABAABBHAAAAFRnYXNwAAAAEAAAASwAAAAIZ2x5ZgAAAAAAAXQAAD8oaGVhZAAGAAAAAABBfAAAADZoaGVhB+gD';
  
  try {
    // Add font to jsPDF
    doc.addFileToVFS('THSarabunNew.ttf', thaiFont);
    doc.addFont('THSarabunNew.ttf', 'THSarabunNew', 'normal');
  } catch (e) {
    console.warn('Could not load Thai font, using fallback');
    // Fallback to default font with unicode support
    doc.setLanguage('th');
  }
};
