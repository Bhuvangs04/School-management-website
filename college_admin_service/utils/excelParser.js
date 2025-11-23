import Excel from "exceljs";

/**
 * Stream-parse excel file and yield a normalized object per row.
 * Expect header row with: name, email, rollNumber, parentName, parentEmail, class, section
 */
export async function parseExcelRows(filePath, onRow) {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) throw new Error("No worksheet found");

    // read headers
    const headerRow = sheet.getRow(1);
    const headers = headerRow.values.map(v => (typeof v === "string" ? v.trim().toLowerCase() : v));
    // iterate rows
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        row.values.forEach((val, idx) => {
            const key = headers[idx];
            if (!key) return;
            obj[key] = val ? String(val).trim() : "";
        });
        onRow(obj, rowNumber);
    });
}
