export const getEmailTemplate = (content) => `
  <html>
    <body style="background-color:#f9f9f9;padding:20px;">
      <div style="max-width:600px;margin:auto;background:#fff;padding:20px;border:1px solid #ddd;border-radius:5px;">
        ${content}
      </div>
    </body>
  </html>
`;
