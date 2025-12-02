import { buildSectionsFromDocx } from "../utils/buildSectionsFromDocx.js";

const docxPath =
  "C:/Projectos/dataBaseUi/dataBaseUi/dataBase/src/components/services/blogPost/input.docx";

buildSectionsFromDocx(docxPath)
  .then((sections) => {
    console.log("\n✅ Extracted Sections from DOCX:\n");
    console.log(JSON.stringify(sections, null, 2));
  })
  .catch((err) => console.error("❌ Error:", err));