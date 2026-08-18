import * as XLSX from 'xlsx';
import { parse } from 'date-fns';
import { SaleRecord } from '../types';

// Expected column names
const COL_FECHA = "Fecha Creacion";
const COL_TOTAL = "Total";
const COL_ESTADO = "Estado Nombre";
const COL_USUARIO = "Usuario Vendedor Nombre";

export function parseExcelSales(file: File): Promise<SaleRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        if (workbook.SheetNames.length === 0) {
          throw new Error("El archivo no tiene hojas.");
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse sheet as an array of arrays to easily skip the first row
        // header: 1 gives us a 2D array.
        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rawData.length < 2) {
          throw new Error("El archivo no contiene suficientes datos.");
        }

        // The first row (index 0) is a global title we should ignore.
        // The second row (index 1) contains the actual headers.
        const headers = rawData[1];

        // Find indexes of the columns we care about
        const fechaIdx = headers.findIndex((h) => typeof h === 'string' && h.trim() === COL_FECHA);
        const totalIdx = headers.findIndex((h) => typeof h === 'string' && h.trim() === COL_TOTAL);
        const estadoIdx = headers.findIndex((h) => typeof h === 'string' && h.trim() === COL_ESTADO);
        const usuarioIdx = headers.findIndex((h) => typeof h === 'string' && h.trim() === COL_USUARIO);

        if (fechaIdx === -1 || totalIdx === -1 || estadoIdx === -1 || usuarioIdx === -1) {
          throw new Error("No se encontraron todas las columnas requeridas (Fecha Creacion, Total, Estado Nombre, Usuario Vendedor Nombre).");
        }

        const records: SaleRecord[] = [];

        // Iterate from the third row (index 2) onwards
        for (let i = 2; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue; // Skip empty rows

          // Extract only the 4 required columns, ignoring everything else
          const rawFecha = row[fechaIdx];
          const rawTotal = row[totalIdx];
          const rawEstado = row[estadoIdx];
          const rawUsuario = row[usuarioIdx];

          // Skip if all are undefined (empty row)
          if (rawFecha === undefined && rawTotal === undefined && rawEstado === undefined && rawUsuario === undefined) {
            continue;
          }

          let fechaObj: Date;
          if (typeof rawFecha === 'number') {
             // Excel date serial number (days since Dec 30, 1899)
             const epochUtc = Date.UTC(1899, 11, 30);
             const dateUtc = new Date(epochUtc + Math.round(rawFecha * 86400000));
             // Create local date with the exact same year/month/day/hour/min/sec as the UTC date
             fechaObj = new Date(
               dateUtc.getUTCFullYear(),
               dateUtc.getUTCMonth(),
               dateUtc.getUTCDate(),
               dateUtc.getUTCHours(),
               dateUtc.getUTCMinutes(),
               dateUtc.getUTCSeconds()
             );
          } else if (typeof rawFecha === 'string') {
             // Try parsing the specific format "2026-08-08 18:58:41"
             try {
                fechaObj = parse(rawFecha.trim(), 'yyyy-MM-dd HH:mm:ss', new Date());
             } catch (e) {
                fechaObj = new Date(rawFecha); // fallback
             }
          } else {
             fechaObj = new Date(); // fallback or invalid
          }

          const parsedTotal = parseFloat(String(rawTotal).replace(/[^0-9.-]+/g,""));

          records.push({
            fechaCreacion: isNaN(fechaObj.getTime()) ? new Date(0) : fechaObj,
            total: isNaN(parsedTotal) ? 0 : parsedTotal,
            estadoNombre: typeof rawEstado === 'string' ? rawEstado.trim() : String(rawEstado || ''),
            usuarioVendedorNombre: typeof rawUsuario === 'string' ? rawUsuario.trim() : String(rawUsuario || ''),
          });
        }

        resolve(records);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsBinaryString(file);
  });
}
