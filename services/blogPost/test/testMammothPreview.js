// test/testMammothPreview.js
import mammoth from "mammoth";

const docxPath =
  "C:/Projectos/dataBaseUi/dataBaseUi/dataBase/src/components/services/blogPost/input.docx";

const { value: html } = await mammoth.convertToHtml({ path: docxPath });

console.log(html.slice(0, 2000)); // first 2 KB preview
