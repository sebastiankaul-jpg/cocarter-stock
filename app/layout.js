export const metadata = {
  title: 'Co.Carter Stock',
  description: 'Sistema interno de stock, producción y ventas'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{margin:0,fontFamily:'Arial, sans-serif',background:'#f7faf9',color:'#183b38'}}>
        {children}
      </body>
    </html>
  );
}
