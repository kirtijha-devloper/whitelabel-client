import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Converts an image URL to base64
 */
const imageToBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      // If CORS fails, try without crossOrigin
      const img2 = new Image();
      img2.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img2.width;
        canvas.height = img2.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img2, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img2.onerror = reject;
      img2.src = url;
    };
    img.src = url;
  });
};

/**
 * Preloads images and returns base64 data
 */
const preloadImages = async (imageUrls) => {
  const imageData = {};
  for (const [key, url] of Object.entries(imageUrls)) {
    if (url) {
      try {
        if (url.startsWith('data:')) {
          imageData[key] = url;
        } else {
          imageData[key] = await imageToBase64(url);
        }
      } catch (error) {
        console.warn(`Failed to load image ${key}:`, error);
        imageData[key] = '';
      }
    }
  }
  return imageData;
};

/**
 * Generates a PDF invoice from transaction data
 * @param {Object} transactionData - Transaction data object
 * @param {Object} merchantData - Merchant/user data object
 * @param {Object} beneficiaryData - Beneficiary data object
 * @param {string} logoUrl - Optional logo image URL (defaults to ABHEEPAY logo)
 * @param {string} headerImageUrl - Optional header image URL for top section
 */
export const generateInvoicePDF = async (
  transactionData,
  merchantData,
  beneficiaryData,
  logoUrl = null,
  headerImageUrl = null
) => {
  // Generate receipt number (format: AP-XXXXXX)
  const receiptNumber = `AP-${String(transactionData.id || Date.now()).padStart(6, '0')}`;
  const currentDate = new Date(transactionData.date || Date.now());
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate service charge (if available)
  const serviceCharge = transactionData.service_charge || transactionData.charge_amount || 0;
  const transactionAmount = parseFloat(transactionData.amount || 0);
  const totalAmount = transactionAmount + parseFloat(serviceCharge);

  // Preload images
  const images = await preloadImages({
    logo: logoUrl,
    header: headerImageUrl,
  });

  // Create a temporary div to render the invoice HTML
  const invoiceHTML = `
    <div id="invoice-template" style="width: 800px; padding: 0; background: white; font-family: Arial, sans-serif;">
      ${
        images.header
          ? `
        <!-- Header Image -->
        <div style="width: 100%; margin-bottom: 0;">
          <img src="${images.header}" style="width: 100%; height: auto; display: block; max-height: 150px; object-fit: cover;" alt="Header" />
        </div>
      `
          : `
        <!-- Header with wave design (fallback if no header image) -->
        <div style="position: relative; height: 100px; margin-bottom: 30px; overflow: hidden; background: linear-gradient(135deg, #00D3CD 0%, #00bdb7 100%);">
          <div style="position: absolute; bottom: -20px; left: 0; width: 100%; height: 60px; background: #000; border-radius: 50% 50% 0 0;"></div>
        </div>
      `
      }

      <!-- Logo and Company Info -->
      <div style="padding: 40px 40px 20px 40px;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          ${
            images.logo
              ? `
            <img src="${images.logo}" style="height: 60px; width: auto; max-width: 200px; margin-right: 15px; object-fit: contain;" alt="ABHEEPAY Logo" />
          `
              : `
            <div style="width: 60px; height: 60px; border-radius: 50%; background: #000; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
              <span style="color: white; font-weight: bold; font-size: 24px;">A</span>
            </div>
          `
          }
          ${!images.logo ? `
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #000; margin-bottom: 5px;">ABHEEPAY</div>
            <div style="font-size: 10px; color: #666;">FAST SECURE PAYMENT</div>
          </div>
          ` : ''}
        </div>

        <!-- Receipt Title -->
        <div style="text-align: center; margin: 30px 0;">
          <h1 style="font-size: 36px; font-weight: bold; color: #000; margin: 0; letter-spacing: 2px;">PAYMENT RECEIPT</h1>
        </div>

        <!-- Receipt Number and Date -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #ddd;">
          <div style="font-size: 14px; color: #333;">
            <strong>Receipt No:</strong> ${receiptNumber}
          </div>
          <div style="font-size: 14px; color: #333;">
            <strong>Date:</strong> ${formattedDate}
          </div>
        </div>

        <!-- Billed To and Payment Summary -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div style="flex: 1; margin-right: 20px;">
            <h3 style="font-size: 16px; font-weight: bold; color: #000; margin-bottom: 15px;">Billed To:</h3>
            <div style="font-size: 14px; color: #333; line-height: 1.8;">
              <div><strong>Name:</strong> ${beneficiaryData?.beneficiary_name || merchantData?.name || 'N/A'}</div>
              <div><strong>Contact:</strong> ${beneficiaryData?.mobile_number || merchantData?.mobile_number || 'N/A'}</div>
              <div><strong>Email:</strong> ${beneficiaryData?.email || merchantData?.email || 'N/A'}</div>
              <div><strong>Address:</strong> ${merchantData?.address1 || 'N/A'}</div>
            </div>
          </div>
          <div style="flex: 1; margin-left: 20px;">
            <h3 style="font-size: 16px; font-weight: bold; color: #000; margin-bottom: 15px;">Payment Summary:</h3>
            <div style="font-size: 14px; color: #333; line-height: 1.8;">
              <div><strong>Total Paid:</strong> ₹${totalAmount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</div>
              <div><strong>Payment Method:</strong> ${transactionData.payment_method || 'Bank Transfer'}</div>
              <div><strong>Transaction ID:</strong> ${transactionData.reference_id || transactionData.id || 'N/A'}</div>
            </div>
          </div>
        </div>

        <!-- Service Breakdown Table -->
        <div style="margin-bottom: 30px;">
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-size: 14px; font-weight: bold; color: #000;">Service</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd; font-size: 14px; font-weight: bold; color: #000;">Amount</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd; font-size: 14px; font-weight: bold; color: #000;">Charges</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd; font-size: 14px; font-weight: bold; color: #000;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">${transactionData.purpose || 'Payout Transaction'}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">₹${transactionAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">₹${parseFloat(serviceCharge).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; font-size: 14px; font-weight: bold; color: #000;">₹${totalAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Payment Terms and Authorized By -->
        <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
          <div style="flex: 1; margin-right: 20px;">
            <h3 style="font-size: 16px; font-weight: bold; color: #000; margin-bottom: 10px;">Payment Terms:</h3>
            <div style="font-size: 12px; color: #666; line-height: 1.6;">
              <div>• For inquiries, contact care@abheepay.com, 1800 833 2588</div>
            </div>
          </div>
          <div style="flex: 1; margin-left: 20px; text-align: right;">
            <h3 style="font-size: 16px; font-weight: bold; color: #000; margin-bottom: 10px;">Authorized By:</h3>
            <div style="font-size: 12px; color: #666; margin-bottom: 40px;">
              <div>${merchantData?.name || 'Retailer Name'}</div>
              <div>${merchantData?.role || 'User Type'}</div>
            </div>
            <div style="border-top: 1px solid #333; padding-top: 5px; width: 150px; margin-left: auto;">
              <div style="font-size: 10px; color: #666;">Signature</div>
            </div>
          </div>
        </div>

        <!-- Thank You Message -->
        <div style="margin-top: 40px; margin-bottom: 20px;">
          <p style="font-size: 18px; font-weight: bold; color: #000;">Thank You for Your Payment!</p>
        </div>

        <!-- Footer -->
        <div style="background: #00D3CD; padding: 15px; border-radius: 5px; margin-top: 30px;">
          <div style="display: flex; justify-content: space-around; align-items: center; font-size: 12px; color: #000;">
            <div style="display: flex; align-items: center;">
              <span style="margin-right: 5px;">📞</span>
              <span>1800 833 2588</span>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="margin-right: 5px;">🌐</span>
              <span>www.abheepay.com</span>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="margin-right: 5px;">✉️</span>
              <span>care@abheepay.com</span>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="margin-right: 5px;">📍</span>
              <span>Dwarka Delhi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create a temporary container
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = invoiceHTML;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  document.body.appendChild(tempDiv);

  const invoiceElement = tempDiv.querySelector('#invoice-template');

  try {
    // Wait for images to load
    const imagesInTemplate = invoiceElement.querySelectorAll('img');
    await Promise.all(
      Array.from(imagesInTemplate).map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve();
            } else {
              img.onload = resolve;
              img.onerror = resolve; // Continue even if image fails
            }
          })
      )
    );

    // Additional wait to ensure rendering
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Convert HTML to canvas
    const canvas = await html2canvas(invoiceElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgScaledWidth = imgWidth * ratio;
    const imgScaledHeight = imgHeight * ratio;
    const xOffset = (pdfWidth - imgScaledWidth) / 2;

    pdf.addImage(imgData, 'PNG', xOffset, 0, imgScaledWidth, imgScaledHeight);

    // Generate filename
    const filename = `Invoice_${receiptNumber}_${Date.now()}.pdf`;
    pdf.save(filename);

    // Clean up
    document.body.removeChild(tempDiv);
  } catch (error) {
    console.error('Error generating PDF:', error);
    document.body.removeChild(tempDiv);
    throw new Error('Failed to generate invoice PDF');
  }
};
