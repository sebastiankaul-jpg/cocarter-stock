'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { badgeStyle, categories, downloadCsv, sizes } from '../components/helpers';

const card = {background:'white',borderRadius:18,padding:20,boxShadow:'0 8px 24px rgba(0,0,0,.06)'};
const input = {width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #d7e3e0',boxSizing:'border-box'};
const button = {padding:'12px 16px',borderRadius:12,border:'none',background:'#59c2be',color:'#083634',fontWeight:700,cursor:'pointer'};

export default function Home() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState({username:'', password:''});
  const [tab, setTab] = useState('inicio');
  const [stockCart, setStockCart] = useState([]);
  const [saleCart, setSaleCart] = useState([]);
  const [productForm, setProductForm] = useState({category:categories[0], name:'', size:sizes[0], color:'', print:'', code:'', quantity:1});
  const [productionForm, setProductionForm] = useState({category:categories[0], name:'', size:sizes[0], color:'', print:'', code:'', quantity:1, note:''});
  const [search, setSearch] = useState('');
  const [shipping, setShipping] = useState({full_name:'', phone:'', email:'', street:'', number:'', floor:'', locality:'', province:'', postal_code:'', notes:''});
  const [newUser, setNewUser] = useState({name:'', username:'', password:'', role:'vendedor'});

  async function loadAll() {
    if (!supabase) { setError('Faltan las variables de entorno de Supabase.'); return; }
    const [u, i, m, o] = await Promise.all([
      supabase.from('users').select('*').order('id'),
      supabase.from('inventory_items').select('*').order('id'),
      supabase.from('movements').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false })
    ]);
    if (u.error || i.error || m.error || o.error) {
      setError(u.error?.message || i.error?.message || m.error?.message || o.error?.message || 'Error al cargar datos');
      return;
    }
    setUsers(u.data || []);
    setInventory(i.data || []);
    setMovements(m.data || []);
    setOrders(o.data || []);
    setReady(true);
  }

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('stock-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return inventory;
    return inventory.filter(i => [i.category,i.name,i.size,i.color,i.print,i.code].some(v => String(v||'').toLowerCase().includes(q)));
  }, [search, inventory]);

  const lowStock = inventory.filter(i => i.stock > 0 && i.stock < 3);
  const noStock = inventory.filter(i => i.stock === 0);
  const topSold = [...inventory].sort((a,b) => (b.sold||0) - (a.sold||0)).slice(0,5);

  function can(target) {
    if (!user) return false;
    if (user.role === 'administrador') return true;
    if (user.role === 'vendedor') return ['inicio','vender','stock','buscar'].includes(target);
    if (user.role === 'deposito') return ['inicio','cargar','produccion','stock','buscar'].includes(target);
    return false;
  }

  function handleLogin() {
    const found = users.find(u => u.username === login.username && u.password === login.password && u.active);
    if (!found) { setError('Usuario o contraseña incorrectos'); return; }
    setError('');
    setUser(found);
    setTab(found.role === 'vendedor' ? 'vender' : found.role === 'deposito' ? 'cargar' : 'inicio');
  }

  function addToStockCart() {
    if (!productForm.name || !productForm.color || !productForm.code) return;
    setStockCart([...stockCart, {...productForm, quantity:Number(productForm.quantity)}]);
    setProductForm({category:categories[0], name:'', size:sizes[0], color:'', print:'', code:'', quantity:1});
  }

  async function confirmStockCart(type='Ingreso') {
    if (!supabase || !stockCart.length || !user) return;
    for (const item of stockCart) {
      const existing = inventory.find(x => x.code === item.code);
      if (existing) {
        await supabase.from('inventory_items').update({
          stock: existing.stock + Number(item.quantity),
          produced: (existing.produced || 0) + Number(item.quantity)
        }).eq('id', existing.id);
      } else {
        await supabase.from('inventory_items').insert({
          category:item.category,name:item.name,size:item.size,color:item.color,print:item.print,code:item.code,stock:Number(item.quantity),produced:Number(item.quantity),sold:0
        });
      }
      await supabase.from('movements').insert({
        user_name:user.username,
        type,
        product_code:item.code,
        product_label:`${item.category} · ${item.name} · ${item.size}`,
        quantity:Number(item.quantity),
        note:type === 'Producción' ? (productionForm.note || '') : ''
      });
    }
    setStockCart([]);
    await loadAll();
  }

  function addSaleItem(item) {
    if (item.stock === 0) return;
    const found = saleCart.find(x => x.code === item.code);
    if (found) {
      if (found.quantity + 1 > item.stock) return;
      setSaleCart(saleCart.map(x => x.code === item.code ? {...x, quantity:x.quantity + 1} : x));
      return;
    }
    setSaleCart([...saleCart, {...item, quantity:1}]);
  }

  function changeSaleQty(code, qty) {
    const inv = inventory.find(x => x.code === code);
    const n = Math.max(1, Number(qty || 1));
    if (!inv || n > inv.stock) return;
    setSaleCart(saleCart.map(x => x.code === code ? {...x, quantity:n} : x));
  }

  async function finalizeSale() {
    if (!supabase || !saleCart.length || !shipping.full_name || !user) return;
    for (const item of saleCart) {
      const current = inventory.find(x => x.code === item.code);
      if (!current || current.stock < item.quantity) {
        setError(`Stock insuficiente para ${item.code}`);
        return;
      }
    }
    for (const item of saleCart) {
      const current = inventory.find(x => x.code === item.code);
      await supabase.from('inventory_items').update({
        stock: current.stock - Number(item.quantity),
        sold: (current.sold || 0) + Number(item.quantity)
      }).eq('id', current.id);
      await supabase.from('movements').insert({
        user_name:user.username,
        type:'Venta',
        product_code:item.code,
        product_label:`${item.category} · ${item.name} · ${item.size}`,
        quantity:Number(item.quantity)
      });
    }
    await supabase.from('orders').insert({
      seller_name:user.name,
      customer_name:shipping.full_name,
      phone:shipping.phone,
      email:shipping.email,
      street:shipping.street,
      number:shipping.number,
      floor:shipping.floor,
      locality:shipping.locality,
      province:shipping.province,
      postal_code:shipping.postal_code,
      notes:shipping.notes,
      items_json:saleCart
    });
    setSaleCart([]);
    setShipping({full_name:'', phone:'', email:'', street:'', number:'', floor:'', locality:'', province:'', postal_code:'', notes:''});
    setError('');
    await loadAll();
  }

  async function createUser() {
    if (!supabase || user?.role !== 'administrador') return;
    await supabase.from('users').insert({ ...newUser, active:true });
    setNewUser({name:'', username:'', password:'', role:'vendedor'});
    await loadAll();
  }

  async function toggleUser(id, active) {
    if (!supabase || user?.role !== 'administrador') return;
    await supabase.from('users').update({ active: !active }).eq('id', id);
    await loadAll();
  }

  function exportInventory() {
    downloadCsv('stock_cocarter.csv', [
      ['Código','Artículo','Talle','Color','Estampa','Cantidad'],
      ...inventory.map(i => [i.code, `${i.category} ${i.name}`, i.size, i.color, i.print, i.stock])
    ]);
  }

  function exportLastOrder() {
    if (!orders[0]) return;
    const o = orders[0];
    const items = Array.isArray(o.items_json) ? o.items_json : [];
    downloadCsv('pedido_cocarter.csv', [
      ['Código','Artículo','Talle','Color','Estampa','Cantidad','Cliente','Teléfono','Email','Calle','Altura','Piso/Depto','Localidad','Provincia','Código postal','Observaciones'],
      ...items.map(i => [i.code, `${i.category} ${i.name}`, i.size, i.color, i.print, i.quantity, o.customer_name, o.phone, o.email, o.street, o.number, o.floor, o.locality, o.province, o.postal_code, o.notes])
    ]);
  }

  if (!ready) return <div style={{padding:40}}>Cargando proyecto… {error && <div>{error}</div>}</div>;

  if (!user) {
    return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:'linear-gradient(180deg,#f7faf9,#eef8f7)'}}>
      <div style={{...card, width:'100%', maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{width:92,height:92,borderRadius:'50%',background:'#dff5f3',display:'grid',placeItems:'center',margin:'0 auto 14px',fontWeight:800,fontSize:28,color:'#19706a'}}>Co</div>
          <h1 style={{margin:'0 0 8px'}}>{'Co.Carter Stock'}</h1>
          <div style={{color:'#56726f'}}>Ingreso privado para administración, ventas y depósito</div>
        </div>
        <div style={{display:'grid',gap:12}}>
          <input style={input} placeholder="Usuario" value={login.username} onChange={e => setLogin({...login, username:e.target.value})} />
          <input style={input} type="password" placeholder="Contraseña" value={login.password} onChange={e => setLogin({...login, password:e.target.value})} />
          <button style={button} onClick={handleLogin}>Ingresar</button>
          {error && <div style={{color:'#b91c1c',fontSize:14}}>{error}</div>}
        </div>
      </div>
    </div>;
  }

  return <div>
    <div style={{position:'sticky',top:0,zIndex:10,background:'rgba(255,255,255,.95)',backdropFilter:'blur(8px)',borderBottom:'1px solid #e3ecea'}}>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'#dff5f3',display:'grid',placeItems:'center',fontWeight:800,color:'#19706a'}}>Co</div>
          <div><div style={{fontWeight:800,fontSize:20}}>Co.Carter Stock</div><div style={{fontSize:12,color:'#56726f'}}>{user.name} · {user.role}</div></div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {['inicio','cargar','produccion','vender','stock','buscar','movimientos','reportes','usuarios'].filter(can).map(t => <button key={t} style={{...button, background: tab===t ? '#59c2be' : '#eef8f7'}} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}
          <button style={{...button, background:'#eef8f7'}} onClick={exportInventory}>Exportar stock</button>
          <button style={{...button, background:'#eef8f7'}} onClick={exportLastOrder}>Exportar pedido</button>
          <button style={{...button, background:'#eef8f7'}} onClick={()=>setUser(null)}>Salir</button>
        </div>
      </div>
    </div>

    <div style={{maxWidth:1200,margin:'0 auto',padding:16,display:'grid',gap:16}}>
      {error && <div style={{...card,color:'#b91c1c'}}>{error}</div>}

      {tab==='inicio' && <div style={{display:'grid',gap:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
          <Stat title="Stock total" value={inventory.reduce((a,b)=>a+b.stock,0)} />
          <Stat title="Poco stock" value={lowStock.length} />
          <Stat title="Sin stock" value={noStock.length} />
          <Stat title="Usuarios activos" value={users.filter(u=>u.active).length} />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
          {can('cargar') && <Action title="Cargar productos" text="Ingresar mercadería nueva al stock." onClick={()=>setTab('cargar')} />}
          {can('produccion') && <Action title="Producción" text="Registrar prendas fabricadas y sumarlas al stock." onClick={()=>setTab('produccion')} />}
          {can('vender') && <Action title="Vender" text="Armar un pedido y descontar stock automáticamente." onClick={()=>setTab('vender')} />}
        </div>
      </div>}

      {tab==='cargar' && can('cargar') && <TwoCols left={<div style={card}>
        <h2>Cargar productos</h2>
        <FormProduct form={productForm} setForm={setProductForm} />
        <button style={{...button,marginTop:12}} onClick={addToStockCart}>Agregar al carrito</button>
      </div>} right={<Cart title="Carrito de ingreso" items={stockCart} setItems={setStockCart} onConfirm={()=>confirmStockCart('Ingreso')} />} />}

      {tab==='produccion' && can('produccion') && <TwoCols left={<div style={card}>
        <h2>Producción</h2>
        <FormProduct form={productionForm} setForm={setProductionForm} />
        <textarea style={{...input,minHeight:90,marginTop:12}} placeholder="Observación" value={productionForm.note} onChange={e=>setProductionForm({...productionForm,note:e.target.value})} />
        <button style={{...button,marginTop:12}} onClick={()=>{setStockCart([...stockCart,{...productionForm,quantity:Number(productionForm.quantity)}]); setProductionForm({category:categories[0], name:'', size:sizes[0], color:'', print:'', code:'', quantity:1, note:''});}}>Agregar al carrito</button>
      </div>} right={<Cart title="Carrito de producción" items={stockCart} setItems={setStockCart} onConfirm={()=>confirmStockCart('Producción')} />} />}

      {tab==='vender' && can('vender') && <TwoCols left={<div style={card}>
        <h2>Buscar artículos</h2>
        <input style={input} placeholder="Buscar por nombre, talle, color, estampa o código" value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginTop:12}}>
          {filteredInventory.map(item => <div key={item.id} style={{border:'1px solid #e3ecea',borderRadius:14,padding:12}}>
            <div style={{fontWeight:700}}>{item.name}</div>
            <div style={{fontSize:13,color:'#56726f'}}>{item.category} · {item.size} · {item.color}</div>
            <div style={{fontSize:12,color:'#56726f'}}>{item.code} · {item.print}</div>
            <div style={{margin:'10px 0'}}><span style={{padding:'6px 10px',borderRadius:999,...badgeStyle(item.stock)}}>{item.stock === 0 ? 'Sin stock' : `Stock ${item.stock}`}</span></div>
            <button style={{...button, width:'100%', background:item.stock===0?'#f1f5f4':'#eef8f7'}} disabled={item.stock===0} onClick={()=>addSaleItem(item)}>Agregar</button>
          </div>)}
        </div>
      </div>} right={<div style={{display:'grid',gap:16}}>
        <Cart title="Carrito de venta" items={saleCart} setItems={setSaleCart} editableQty changeQty={changeSaleQty} onConfirm={finalizeSale} confirmLabel="Finalizar venta" />
        <div style={card}>
          <h2>Datos del cliente</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
            {[
              ['full_name','Nombre y apellido'],['phone','Teléfono'],['email','Email'],['street','Calle'],['number','Altura'],['floor','Piso / depto'],['locality','Localidad'],['province','Provincia'],['postal_code','Código postal'],['notes','Observaciones']
            ].map(([k,l]) => <input key={k} style={input} placeholder={l} value={shipping[k]} onChange={e=>setShipping({...shipping,[k]:e.target.value})} />)}
          </div>
        </div>
      </div>} />}

      {tab==='stock' && can('stock') && <div style={card}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}><h2>Stock actual</h2><input style={{...input,maxWidth:320}} placeholder="Buscar producto" value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <Table inventory={filteredInventory} />
      </div>}

      {tab==='buscar' && can('buscar') && <div style={card}><h2>Buscar producto</h2><input style={input} placeholder="Buscar por nombre, talle, color, estampa o código" value={search} onChange={e=>setSearch(e.target.value)} /><Table inventory={filteredInventory} compact /></div>}

      {tab==='movimientos' && can('movimientos') && <div style={card}><h2>Movimientos</h2><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><Th>Fecha</Th><Th>Usuario</Th><Th>Tipo</Th><Th>Producto</Th><Th>Código</Th><Th>Cantidad</Th></tr></thead><tbody>{movements.map(m => <tr key={m.id}><Td>{new Date(m.created_at).toLocaleString('es-AR')}</Td><Td>{m.user_name}</Td><Td>{m.type}</Td><Td>{m.product_label}</Td><Td>{m.product_code}</Td><Td>{m.quantity}</Td></tr>)}</tbody></table></div>}

      {tab==='reportes' && can('reportes') && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16}}>
        <Report title="Productos sin stock" items={noStock.map(i => `${i.code} · ${i.name} · ${i.size}`)} />
        <Report title="Productos con poco stock" items={lowStock.map(i => `${i.code} · ${i.name} · ${i.stock} unidades`)} />
        <Report title="Lo más vendido" items={topSold.map(i => `${i.code} · ${i.name} · vendidos: ${i.sold || 0}`)} />
        <Report title="Producción cargada" items={inventory.map(i => `${i.code} · ${i.name} · producidos: ${i.produced || 0}`)} />
      </div>}

      {tab==='usuarios' && can('usuarios') && <TwoCols left={<div style={card}><h2>Crear usuario</h2>
        <input style={input} placeholder="Nombre" value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})} />
        <div style={{height:12}} />
        <input style={input} placeholder="Usuario" value={newUser.username} onChange={e=>setNewUser({...newUser,username:e.target.value})} />
        <div style={{height:12}} />
        <input style={input} placeholder="Contraseña" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})} />
        <div style={{height:12}} />
        <select style={input} value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}><option>vendedor</option><option>deposito</option><option>administrador</option></select>
        <button style={{...button,marginTop:12}} onClick={createUser}>Crear usuario</button>
      </div>} right={<div style={card}><h2>Gestión de usuarios</h2>{users.map(u => <div key={u.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,border:'1px solid #e3ecea',borderRadius:14,padding:12,marginTop:10}}><div><div style={{fontWeight:700}}>{u.name}</div><div style={{fontSize:13,color:'#56726f'}}>{u.username} · {u.role}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{padding:'6px 10px',borderRadius:999,background:u.active?'#e6f4f1':'#fee2e2',color:u.active?'#115e59':'#b91c1c'}}>{u.active?'Activo':'Inactivo'}</span>{u.id !== user.id && <button style={{...button, background:'#eef8f7'}} onClick={()=>toggleUser(u.id, u.active)}>{u.active?'Desactivar':'Activar'}</button>}</div></div>)}</div>} />}
    </div>
  </div>;
}

function FormProduct({ form, setForm }) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
    <select style={inputStyle} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c => <option key={c}>{c}</option>)}</select>
    <input style={inputStyle} placeholder="Nombre / modelo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
    <select style={inputStyle} value={form.size} onChange={e=>setForm({...form,size:e.target.value})}>{sizes.map(s => <option key={s}>{s}</option>)}</select>
    <input style={inputStyle} placeholder="Color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})} />
    <input style={inputStyle} placeholder="Estampa" value={form.print} onChange={e=>setForm({...form,print:e.target.value})} />
    <input style={inputStyle} placeholder="Código" value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})} />
    <input style={inputStyle} type="number" min="1" placeholder="Cantidad" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} />
  </div>;
}

function Cart({ title, items, setItems, onConfirm, confirmLabel='Confirmar', editableQty=false, changeQty }) {
  return <div style={card}><h2>{title}</h2>{items.length===0?<div style={{color:'#56726f'}}>Todavía no agregaste artículos.</div>:items.map((item,idx)=><div key={idx} style={{border:'1px solid #e3ecea',borderRadius:14,padding:12,marginBottom:10}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><div><div style={{fontWeight:700}}>{item.name}</div><div style={{fontSize:12,color:'#56726f'}}>{item.category} · {item.size} · {item.color} · {item.code}</div></div><button style={{...button,background:'#eef8f7'}} onClick={()=>setItems(items.filter((_,i)=>i!==idx))}>Quitar</button></div>{editableQty?<input style={{...inputStyle,marginTop:10}} type="number" min="1" value={item.quantity} onChange={e=>changeQty(item.code,e.target.value)} />:<div style={{marginTop:8,color:'#56726f'}}>Cantidad: {item.quantity}</div>}</div>)}<button style={{...button,width:'100%'}} onClick={onConfirm}>{confirmLabel}</button></div>;
}

function Table({ inventory, compact=false }) {
  return <div style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><Th>Código</Th><Th>Artículo</Th><Th>Talle</Th><Th>Color</Th><Th>Estampa</Th><Th>Stock</Th></tr></thead><tbody>{inventory.map(item => <tr key={item.id}><Td>{item.code}</Td><Td>{item.category} · {item.name}</Td><Td>{item.size}</Td><Td>{item.color}</Td><Td>{item.print}</Td><Td><span style={{padding:'6px 10px',borderRadius:999,...badgeStyle(item.stock)}}>{item.stock}</span></Td></tr>)}</tbody></table></div>;
}

function Report({ title, items }) { return <div style={card}><h3>{title}</h3>{items.length===0?<div style={{color:'#56726f'}}>Sin datos por ahora.</div>:items.map((x,i)=><div key={i} style={{border:'1px solid #e3ecea',borderRadius:12,padding:10,marginTop:8}}>{x}</div>)}</div>; }
function Stat({ title, value }) { return <div style={card}><div style={{color:'#56726f'}}>{title}</div><div style={{fontSize:32,fontWeight:800,marginTop:8}}>{value}</div></div>; }
function Action({ title, text, onClick }) { return <div style={card}><div style={{fontWeight:800,fontSize:22}}>{title}</div><div style={{margin:'8px 0 14px',color:'#56726f'}}>{text}</div><button style={button} onClick={onClick}>Abrir</button></div>; }
function TwoCols({ left, right }) { return <div style={{display:'grid',gridTemplateColumns:'1.15fr .85fr',gap:16}}>{left}{right}</div>; }
function Th({ children }) { return <th style={{textAlign:'left',padding:'10px 8px',borderBottom:'1px solid #e3ecea',fontSize:14}}>{children}</th>; }
function Td({ children }) { return <td style={{padding:'10px 8px',borderBottom:'1px solid #edf3f2',fontSize:14}}>{children}</td>; }
const inputStyle = {width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #d7e3e0',boxSizing:'border-box'};
