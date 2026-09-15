export interface SaleRecord {
  idVenta?: string;
  fechaCreacion: Date;
  total: number;
  estadoNombre: 'Certificado' | 'Anulado' | string;
  usuarioVendedorNombre: string;
}
