export interface SaleRecord {
  fechaCreacion: Date;
  total: number;
  estadoNombre: 'Certificado' | 'Anulado' | string;
  usuarioVendedorNombre: string;
}
