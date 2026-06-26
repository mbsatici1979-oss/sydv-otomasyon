(function(){
  const endpoint='/api/modules/dogrudanTemin';
  const STEPS=[
    ['1','İhtiyaç','/dogrudan-temin/'],
    ['2','Maliyet Araştırması','/dogrudan-temin/maliyet.html'],
    ['3','Maliyet Hesabı','/dogrudan-temin/hesap.html'],
    ['4','Talep','/dogrudan-temin/talep.html'],
    ['5','Teklif','/dogrudan-temin/teklif.html'],
    ['6','Piyasa Kontrol','/dogrudan-temin/piyasa.html'],
    ['7','İhale Onay','/dogrudan-temin/onay.html'],
    ['8','Damga Vergisi','/dogrudan-temin/damga.html'],
    ['9','Teslim','/dogrudan-temin/teslim.html']
  ];
  let allRecords=[],records=[],sources=[],editing=null;
  const $=selector=>document.querySelector(selector);
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const money=value=>(Number(value)||0).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
  const plainNumber=value=>(Number(value)||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const today=()=>new Date().toISOString().slice(0,10);
  const formatDate=value=>value?new Intl.DateTimeFormat('tr-TR').format(new Date(value+'T00:00:00')):'';
  const formatQuantity=value=>{const number=Number(value);return Number.isFinite(number)?number.toLocaleString('tr-TR',{maximumFractionDigits:2}):value};
  const round2=value=>Number((Number(value)||0).toFixed(2));
  const byId=id=>allRecords.find(item=>item.id===id);
  const byStage=stage=>allRecords.filter(item=>item.stage===stage);
  const itemsText=items=>(items||[]).map(item=>`${formatQuantity(item.quantity)} ${item.unit||''} ${item.material||''}`.trim()).join(', ');
  async function api(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json'}});let data={};try{data=await response.json()}catch{}if(!response.ok){if(response.status===401)top.location.href='/';throw new Error(data.error||'İşlem tamamlanamadı.')}return data}

  const configs={
    onay:{
      key:'onay',stageNo:'7',recordStage:'ihaleOnay',badge:'İhale Onay',title:'İhale Onay Belgeleri',eyebrow:'7. Aşama',intro:'Piyasa ve maliyet kontrolünden gelen uygun alım için ihale onay belgesini hazırlayın.',newText:'+ Yeni İhale Onayı',
      stats:['Toplam Onay','Onaya Hazır','Toplam Tutar'],
      sourceName:'Piyasa ve Maliyet Kontrolü',
      formHtml:onayForm,sourceRecords:()=>byStage('piyasaFiyatVeMaliyetKontrolu').filter(item=>item.canProceed),
      sourceLabel:control=>`${control.documentNo||'Numarasız'} · ${control.subject||'Alım'} · ${control.winnerName||'Firma yok'} · ${money(control.secondEstimatedCost)}`,
      listText:record=>`${record.subject||'İhale Onay Belgesi'} · ${record.winnerName||'Firma yok'}`,
      amount:record=>Number(record.estimatedCost)||Number(record.secondEstimatedCost)||Number(record.winnerTotal)||0,
      fill:fillOnay,collect:collectOnay,validate:validateOnay,print:printOnay
    },
    damga:{
      key:'damga',stageNo:'8',recordStage:'ihaleDamgaVergisi',badge:'Damga Vergisi',title:'İhale Damga Vergisi Yazıları',eyebrow:'8. Aşama',intro:'İhale onayından sonra sözleşme bedeli ve damga vergisi yazısını oluşturun.',newText:'+ Yeni Damga Vergisi Yazısı',
      stats:['Toplam Yazı','Makbuz Alınan','Damga Vergisi Toplamı'],
      sourceName:'İhale Onay Belgesi',
      formHtml:damgaForm,sourceRecords:()=>byStage('ihaleOnay'),
      sourceLabel:approval=>`${approval.documentNo||'Numarasız'} · ${approval.subject||'Alım'} · ${approval.winnerName||'Firma yok'} · ${money(approval.winnerTotal||approval.estimatedCost)}`,
      listText:record=>`${record.subject||'Sözleşme Bedeli'} · ${record.winnerName||'Firma yok'}`,
      amount:record=>Number(record.stampTaxAmount)||0,
      fill:fillDamga,collect:collectDamga,validate:validateDamga,print:printDamga
    },
    teslim:{
      key:'teslim',stageNo:'9',recordStage:'teslimAlmaTutanagi',badge:'Teslim Alma',title:'Teslim Alma Tutanakları',eyebrow:'9. Aşama',intro:'Damga vergisi yazısından sonra mal veya hizmetin teslim alma tutanağını hazırlayın.',newText:'+ Yeni Teslim Tutanağı',
      stats:['Toplam Tutanak','Teslim Alınan','Toplam Alım Tutarı'],
      sourceName:'Damga Vergisi Yazısı',
      formHtml:teslimForm,sourceRecords:()=>byStage('ihaleDamgaVergisi'),
      sourceLabel:stamp=>`${stamp.documentNo||'Numarasız'} · ${stamp.subject||'Alım'} · ${stamp.winnerName||'Firma yok'} · ${money(stamp.contractAmount)}`,
      listText:record=>`${record.subject||'Teslim Alma Tutanağı'} · ${record.supplierName||'Firma yok'}`,
      amount:record=>Number(record.contractAmount)||0,
      fill:fillTeslim,collect:collectTeslim,validate:validateTeslim,print:printTeslim
    }
  };
  const config=configs[window.DT_PAGE]||configs.onay;

  function renderShell(){
    document.title=`${config.badge} · Doğrudan Temin`;
    $('#headerBadge').textContent=config.badge;
    $('#pageEyebrow').textContent=config.eyebrow;
    $('#pageTitle').textContent=config.title;
    $('#pageIntro').textContent=config.intro;
    $('#newRecord').textContent=config.newText;
    $('#stat1Label').textContent=config.stats[0];
    $('#stat2Label').textContent=config.stats[1];
    $('#stat3Label').textContent=config.stats[2];
    $('#editorTitle').textContent=config.newText.replace('+ ','');
    $('#editorHelp').textContent=`Kaynak ${config.sourceName.toLocaleLowerCase('tr-TR')} seçin ve belge bilgilerini doldurun.`;
    $('#form').innerHTML=`<input type="hidden" id="recordId">${config.formHtml()}<p class="save-message" id="formMessage"></p>`;
    $('#stepbar').innerHTML=STEPS.map(([no,label,href],index)=>`${index?'<span class="step-arrow">›</span>':''}<a class="step ${no===config.stageNo?'active':''}" href="${href}"><span class="step-no">${no}</span><span class="step-label">${label}</span></a>`).join('');
  }

  async function load(){
    try{
      const data=await api(endpoint);
      allRecords=data.records||[];
      records=allRecords.filter(record=>record.stage===config.recordStage);
      sources=config.sourceRecords();
      $('#newRecord').disabled=!sources.length;
      $('#newRecord').title=sources.length?'':`Önce ${config.sourceName.toLocaleLowerCase('tr-TR')} kaydı oluşturun.`;
      render();
    }catch(error){
      $('#empty').hidden=false;
      $('#empty').innerHTML='<strong>Kayıtlar yüklenemedi</strong>'+escapeHtml(error.message);
    }
  }

  function render(){
    const query=$('#search').value.trim().toLocaleLowerCase('tr-TR');
    const filtered=records.filter(record=>[record.documentNo,record.subject,record.winnerName,record.supplierName,record.status,record.notes].some(value=>String(value||'').toLocaleLowerCase('tr-TR').includes(query)));
    $('#recordList').innerHTML=filtered.map(recordHtml).join('');
    $('#empty').hidden=filtered.length>0;
    $('#empty').innerHTML=sources.length?`<strong>Henüz kayıt yok</strong>${config.newText.replace('+ ','')} düğmesiyle başlayın.`:`<strong>Önce önceki aşamayı tamamlayın</strong>Bu aşama için en az bir ${config.sourceName.toLocaleLowerCase('tr-TR')} kaydı gerekir.`;
    $('#resultText').textContent=records.length?`${filtered.length} / ${records.length} kayıt`:'';
    $('#stat1').textContent=records.length;
    $('#stat2').textContent=config.key==='onay'?records.filter(record=>['Onaya Hazır','Onaylandı'].includes(record.status)).length:config.key==='damga'?records.filter(record=>record.status==='Makbuz Alındı').length:records.filter(record=>record.status==='Teslim Alındı').length;
    $('#stat3').textContent=money(records.reduce((sum,record)=>sum+config.amount(record),0));
  }

  function recordHtml(record){
    const date=formatDate(record.approvalDate||record.letterDate||record.deliveryDate);
    const badgeClass=['Onaylandı','Makbuz Alındı','Teslim Alındı'].includes(record.status)?'approved':['Onaya Hazır','Gönderildi','Teslim Bekliyor'].includes(record.status)?'ready':'';
    return `<article class="record"><div class="doc-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></svg></div><div><strong>${escapeHtml(record.documentNo||'Numarasız Belge')}</strong><small>${escapeHtml(config.listText(record))}</small></div><div class="record-data"><span>Tarih</span>${date||'—'}</div><div class="record-data"><span>Tutar</span>${money(config.amount(record))}</div><div><span class="badge ${badgeClass}">${escapeHtml(record.status||'Taslak')}</span></div><div class="actions"><button class="icon-btn" data-print="${record.id}">Yazdır</button><button class="icon-btn" data-edit="${record.id}">Düzenle</button><button class="icon-btn danger" data-delete="${record.id}">Sil</button></div></article>`;
  }

  function nextDocumentNo(prefix){
    const year=new Date().getFullYear();
    let max=0;
    records.forEach(record=>{const match=String(record.documentNo||'').match(/(\d+)$/);if(match)max=Math.max(max,Number(match[1]))});
    return `${prefix}-${year}-${String(max+1).padStart(3,'0')}`;
  }

  function populateSources(selected=''){
    const options=sources.map(item=>`<option value="${item.id}" ${item.id===selected?'selected':''}>${escapeHtml(config.sourceLabel(item))}</option>`);
    if(selected&&!sources.some(item=>item.id===selected))options.unshift(`<option value="${escapeHtml(selected)}" selected>Kaynak kayıt artık bulunamıyor</option>`);
    $('#sourceId').innerHTML=`<option value="">${config.sourceName} seçin</option>`+options.join('');
  }

  function openEditor(record=null){
    if(!record&&!sources.length){alert(`Önce ${config.sourceName.toLocaleLowerCase('tr-TR')} kaydı oluşturun.`);return}
    editing=record;
    renderShell();
    $('#form').reset();
    $('#recordId').value=record?.id||'';
    populateSources(configSourceId(record)||sources[0]?.id||'');
    config.fill(record);
    $('#editorTitle').textContent=record?`${config.badge} Kaydını Düzenle`:config.newText.replace('+ ','');
    $('#formMessage').textContent='';
    $('#editor').hidden=false;
    document.body.style.overflow='hidden';
    wireDynamicFields();
  }

  function configSourceId(record){
    if(config.key==='onay')return record?.sourceControlId||'';
    if(config.key==='damga')return record?.sourceApprovalId||'';
    return record?.sourceStampId||'';
  }

  function closeEditor(force=false){
    if(!force&&!confirm('Form kapatılsın mı? Kaydedilmemiş değişiklikler kaybolabilir.'))return;
    $('#editor').hidden=true;
    document.body.style.overflow='';
    editing=null;
  }

  async function save(){
    const record=config.collect();
    const message=config.validate(record);
    if(message){$('#formMessage').textContent=message;return}
    const button=$('#saveEdit');
    button.disabled=true;
    try{
      const id=$('#recordId').value;
      await api(endpoint+(id?'/'+id:''),{method:id?'PUT':'POST',body:JSON.stringify(record)});
      closeEditor(true);
      await load();
    }catch(error){$('#formMessage').textContent=error.message}
    finally{button.disabled=false}
  }

  function wireDynamicFields(){
    $('#sourceId').onchange=()=>config.fill(null,true);
    if(config.key==='damga'){
      ['contractAmount','stampTaxRate'].forEach(id=>$('#'+id).addEventListener('input',()=>{
        $('#stampTaxAmount').value=plainNumber((Number($('#contractAmount').value)||0)*(Number($('#stampTaxRate').value)||0)).replace(/\./g,'').replace(',','.');
      }));
    }
  }

  function getNumber(id){return Number(String($('#'+id).value).replace(',','.'))||0}
  function setValue(id,value){const element=$('#'+id);if(element)element.value=value??''}
  function source(){return byId($('#sourceId').value)}
  function onayByStamp(stamp){return byId(stamp?.sourceApprovalId)}

  function onayForm(){
    return `<section class="form-section"><div class="section-head"><div><h3>Kaynak Piyasa Kontrolü</h3><p>İhaleye devam edilebilir durumdaki kontrol kaydı kullanılır</p></div></div><div class="source-line"><div class="field"><label for="sourceId">Piyasa ve Maliyet Kontrolü *</label><select id="sourceId"></select></div><button class="secondary" id="reloadSource" type="button">Bilgileri Yeniden Getir</button></div><p class="source-note" id="sourceNote"></p></section>
    <section class="form-section"><div class="section-head"><div><h3>Belge Bilgileri</h3><p>İhale onay formunda yer alacak temel alanlar</p></div></div><div class="form-grid"><div class="field"><label for="documentNo">Belge No *</label><input id="documentNo"></div><div class="field"><label for="approvalDate">Belge Tarihi *</label><input id="approvalDate" type="date"></div><div class="field"><label for="status">Belge Durumu</label><select id="status"><option>Taslak</option><option>Onaya Hazır</option><option>Onaylandı</option></select></div><div class="field"><label for="budgetStatus">Kullanılabilir Ödenek</label><input id="budgetStatus"></div><div class="field full"><label for="subject">İşin Adı *</label><input id="subject"></div><div class="field full"><label for="decisionDateNo">Mütevelli Heyeti Kararı Tarih / No</label><input id="decisionDateNo"></div></div></section>
    <section class="form-section"><div class="section-head"><div><h3>İhale Bilgileri</h3><p>Şablondaki iş tanımı, niteliği, miktarı ve maliyet alanları</p></div></div><div class="form-grid"><div class="field full"><label for="jobDefinition">İşin Tanımı *</label><textarea id="jobDefinition"></textarea></div><div class="field full"><label for="jobNature">İşin Niteliği *</label><textarea id="jobNature"></textarea></div><div class="field"><label for="quantityText">İşin Miktarı *</label><input id="quantityText"></div><div class="field"><label for="estimatedCost">Yaklaşık Maliyet - KDV Hariç *</label><input id="estimatedCost" type="number" min="0" step="0.01"></div><div class="field full"><label for="procurementMethod">İhale Usulü</label><input id="procurementMethod"></div><div class="field full"><label for="additionalExplanation">Diğer Açıklamalar</label><textarea id="additionalExplanation"></textarea></div></div></section>
    <section class="form-section"><div class="section-head"><div><h3>Piyasa Araştırması Görevlileri</h3><p>Önceki aşamadaki komisyon üyeleri otomatik aktarılır</p></div></div><div class="sign-grid">${memberFields('member1','1. Üye')}${memberFields('member2','2. Üye')}${memberFields('member3','3. Üye')}</div></section>
    <section class="form-section"><div class="section-head"><div><h3>Onay Bilgileri</h3><p>Vakıf müdürü ve makam onayı</p></div></div><div class="form-grid"><div class="field"><label for="preparedName">Arz Eden Ad Soyad *</label><input id="preparedName"></div><div class="field"><label for="preparedTitle">Arz Eden Unvan *</label><input id="preparedTitle"></div><div class="field"><label for="finalApproverName">Onaylayan Ad Soyad *</label><input id="finalApproverName"></div><div class="field"><label for="finalApproverTitle">Onaylayan Unvan *</label><input id="finalApproverTitle"></div></div></section>`;
  }
  function damgaForm(){
    return `<section class="form-section"><div class="section-head"><div><h3>Kaynak İhale Onayı</h3><p>Onay belgesindeki firma ve tutar bilgileri kullanılır</p></div></div><div class="source-line"><div class="field"><label for="sourceId">İhale Onay Belgesi *</label><select id="sourceId"></select></div><button class="secondary" id="reloadSource" type="button">Bilgileri Yeniden Getir</button></div><p class="source-note" id="sourceNote"></p></section>
    <section class="form-section"><div class="section-head"><div><h3>Yazı Bilgileri</h3><p>Mal müdürlüğüne gönderilecek damga vergisi yazısı</p></div></div><div class="form-grid"><div class="field"><label for="documentNo">Belge No *</label><input id="documentNo"></div><div class="field"><label for="letterDate">Yazı Tarihi *</label><input id="letterDate" type="date"></div><div class="field"><label for="outgoingNo">Sayı</label><input id="outgoingNo"></div><div class="field"><label for="status">Belge Durumu</label><select id="status"><option>Taslak</option><option>Gönderildi</option><option>Makbuz Bekleniyor</option><option>Makbuz Alındı</option></select></div><div class="field"><label for="taxOffice">Hitap *</label><input id="taxOffice"></div><div class="field"><label for="subjectLine">Konu</label><input id="subjectLine"></div><div class="field full"><label for="subject">İşin Adı *</label><input id="subject"></div></div></section>
    <section class="form-section"><div class="section-head"><div><h3>Sözleşme ve Damga Vergisi</h3><p>Oran ve tutar düzenlenebilir bırakılmıştır</p></div></div><div class="form-grid"><div class="field"><label for="winnerName">Yüklenici Firma *</label><input id="winnerName"></div><div class="field"><label for="workType">Alım Türü</label><input id="workType"></div><div class="field"><label for="contractAmount">Sözleşme Bedeli - KDV Hariç *</label><input id="contractAmount" type="number" min="0" step="0.01"></div><div class="field"><label for="stampTaxRate">Damga Vergisi Oranı</label><input id="stampTaxRate" type="number" min="0" step="0.00001"></div><div class="field"><label for="stampTaxAmount">Damga Vergisi Tutarı *</label><input id="stampTaxAmount" type="number" min="0" step="0.01"></div><div class="field"><label for="receiptNo">Makbuz No</label><input id="receiptNo"></div></div><div class="note-box">Varsayılan oran binde 9,48 olarak doldurulur; kullanıcı nihai tutarı elle düzeltebilir.</div></section>
    <section class="form-section"><div class="section-head"><div><h3>İmza ve İşlem Bilgileri</h3><p>Yazıyı imzalayan ve işlem notu</p></div></div><div class="form-grid"><div class="field"><label for="managerName">İmzalayan Ad Soyad *</label><input id="managerName"></div><div class="field"><label for="managerTitle">İmzalayan Unvan *</label><input id="managerTitle"></div><div class="field"><label for="accountantName">Muhasebe Görevlisi</label><input id="accountantName"></div><div class="field"><label for="accountantTitle">Muhasebe Görevlisi Unvanı</label><input id="accountantTitle"></div></div></section>`;
  }
  function teslimForm(){
    return `<section class="form-section"><div class="section-head"><div><h3>Kaynak Damga Vergisi Yazısı</h3><p>Yüklenici ve alım bilgileri önceki aşamadan aktarılır</p></div></div><div class="source-line"><div class="field"><label for="sourceId">Damga Vergisi Yazısı *</label><select id="sourceId"></select></div><button class="secondary" id="reloadSource" type="button">Bilgileri Yeniden Getir</button></div><p class="source-note" id="sourceNote"></p></section>
    <section class="form-section"><div class="section-head"><div><h3>Tutanak Bilgileri</h3><p>Teslim alma metninde kullanılacak bilgiler</p></div></div><div class="form-grid"><div class="field"><label for="documentNo">Belge No *</label><input id="documentNo"></div><div class="field"><label for="deliveryDate">Teslim Tarihi *</label><input id="deliveryDate" type="date"></div><div class="field"><label for="status">Tutanak Durumu</label><select id="status"><option>Taslak</option><option>Teslim Bekliyor</option><option>Teslim Alındı</option></select></div><div class="field"><label for="supplierName">Yüklenici Firma *</label><input id="supplierName"></div><div class="field full"><label for="subject">İşin Adı *</label><input id="subject"></div><div class="field full"><label for="itemText">Teslim Alınan Mal / Hizmet *</label><textarea id="itemText"></textarea></div><div class="field full"><label for="deliveryNote">Ek Açıklama</label><textarea id="deliveryNote"></textarea></div></div></section>
    <section class="form-section"><div class="section-head"><div><h3>Teslim Alan Görevliler</h3><p>Tutanak altında üç imza alanı bulunur</p></div></div><div class="sign-grid">${memberFields('member1','Teslim Alan')}${memberFields('member2','Teslim Alan')}${memberFields('member3','Teslim Alan')}</div></section>`;
  }
  function memberFields(prefix,title){return `<div class="sign-box"><h4>${title}</h4><div class="field"><label for="${prefix}Name">Ad Soyad *</label><input id="${prefix}Name"></div><div class="field"><label for="${prefix}Title">Unvan *</label><input id="${prefix}Title"></div></div>`}

  function fillOnay(record=null,force=false){
    const control=source();
    const list=byId(control?.sourceRequestListId);
    const importedItems=control?.items||list?.items||[];
    setValue('documentNo',record?.documentNo||nextDocumentNo('İOB'));
    setValue('approvalDate',record?.approvalDate||today());
    setValue('status',record?.status||'Taslak');
    setValue('budgetStatus',record?.budgetStatus||'Ödenek var');
    setValue('subject',record?.subject||control?.subject||list?.notes||'');
    setValue('decisionDateNo',record?.decisionDateNo||'');
    setValue('jobDefinition',record?.jobDefinition||control?.subject||list?.notes||'');
    setValue('jobNature',record?.jobNature||control?.subject||list?.notes||'');
    setValue('quantityText',record?.quantityText||itemsText(importedItems));
    setValue('estimatedCost',record?.estimatedCost||control?.secondEstimatedCost||control?.firstEstimatedCost||control?.winnerTotal||'');
    setValue('procurementMethod',record?.procurementMethod||'4734 sayılı Kamu İhale Kanununun 22/d maddesine göre');
    const subject=$('#subject').value||'belirtilen alım';
    setValue('additionalExplanation',record?.additionalExplanation||`Vakfımız Mütevelli Heyetinin kararına istinaden ${subject} alımı.`);
    setValue('member1Name',record?.member1Name||control?.member1Name||'ABDURRAHMAN GÜRBÜZ');
    setValue('member1Title',record?.member1Title||control?.member1Title||'Sosyal Yardım ve İnceleme Görevlisi');
    setValue('member2Name',record?.member2Name||control?.member2Name||'SITKI TURAN BOSTAN');
    setValue('member2Title',record?.member2Title||control?.member2Title||'Sosyal Yardım ve İnceleme Görevlisi');
    setValue('member3Name',record?.member3Name||control?.member3Name||'ÇAĞLAR ANTÜRK');
    setValue('member3Title',record?.member3Title||control?.member3Title||'Sosyal Yardım ve İnceleme Görevlisi');
    setValue('preparedName',record?.preparedName||list?.approvedName||'M. Başar SATICI');
    setValue('preparedTitle',record?.preparedTitle||list?.approvedTitle||'Vakıf Müdürü');
    setValue('finalApproverName',record?.finalApproverName||list?.finalApproverName||'Mustafa Emre KILIÇ');
    setValue('finalApproverTitle',record?.finalApproverTitle||list?.finalApproverTitle||'Kaymakam / Vakıf Başkanı');
    $('#sourceNote').innerHTML=control?`<strong>${escapeHtml(control.documentNo||'Kaynak belge')}</strong> kaydından ${money(control.secondEstimatedCost)} ikinci yaklaşık maliyet ve ${escapeHtml(control.winnerName||'uygun firma')} bilgisi aktarıldı.`:'İhale onayı için 6. aşamadaki uygun piyasa kontrolünü seçin.';
  }
  function collectOnay(){
    const control=source();
    const list=byId(control?.sourceRequestListId);
    return {stage:'ihaleOnay',sourceControlId:$('#sourceId').value,sourceControlNo:control?.documentNo||editing?.sourceControlNo||'',sourceRequestListId:control?.sourceRequestListId||editing?.sourceRequestListId||'',sourceRequestListNo:control?.sourceRequestListNo||editing?.sourceRequestListNo||'',winnerName:control?.winnerName||editing?.winnerName||'',winnerAddress:control?.winnerAddress||editing?.winnerAddress||'',winnerTotal:Number(control?.winnerTotal)||Number(editing?.winnerTotal)||0,firstEstimatedCost:Number(control?.firstEstimatedCost)||Number(editing?.firstEstimatedCost)||0,secondEstimatedCost:Number(control?.secondEstimatedCost)||Number(editing?.secondEstimatedCost)||0,items:(control?.items||list?.items||editing?.items||[]).map(item=>({...item})),documentNo:$('#documentNo').value.trim(),approvalDate:$('#approvalDate').value,status:$('#status').value,budgetStatus:$('#budgetStatus').value.trim(),subject:$('#subject').value.trim(),decisionDateNo:$('#decisionDateNo').value.trim(),jobDefinition:$('#jobDefinition').value.trim(),jobNature:$('#jobNature').value.trim(),quantityText:$('#quantityText').value.trim(),estimatedCost:getNumber('estimatedCost'),procurementMethod:$('#procurementMethod').value.trim(),additionalExplanation:$('#additionalExplanation').value.trim(),member1Name:$('#member1Name').value.trim(),member1Title:$('#member1Title').value.trim(),member2Name:$('#member2Name').value.trim(),member2Title:$('#member2Title').value.trim(),member3Name:$('#member3Name').value.trim(),member3Title:$('#member3Title').value.trim(),preparedName:$('#preparedName').value.trim(),preparedTitle:$('#preparedTitle').value.trim(),finalApproverName:$('#finalApproverName').value.trim(),finalApproverTitle:$('#finalApproverTitle').value.trim()};
  }
  function validateOnay(record){
    if(!record.sourceControlId)return 'Piyasa ve maliyet kontrolü seçin.';
    if(!record.documentNo||!record.approvalDate||!record.subject)return 'Belge bilgilerini eksiksiz doldurun.';
    if(!record.jobDefinition||!record.jobNature||!record.quantityText||record.estimatedCost<=0)return 'İhale bilgilerini eksiksiz doldurun.';
    if([record.member1Name,record.member1Title,record.member2Name,record.member2Title,record.member3Name,record.member3Title,record.preparedName,record.preparedTitle,record.finalApproverName,record.finalApproverTitle].some(value=>!value))return 'Görevli ve onay bilgilerini eksiksiz doldurun.';
    return '';
  }

  function fillDamga(record=null,force=false){
    const approval=source();
    const amount=Number(record?.contractAmount)||Number(approval?.winnerTotal)||Number(approval?.estimatedCost)||Number(approval?.secondEstimatedCost)||0;
    setValue('documentNo',record?.documentNo||nextDocumentNo('DV'));
    setValue('letterDate',record?.letterDate||today());
    setValue('outgoingNo',record?.outgoingNo||`${new Date().getFullYear()}-`);
    setValue('status',record?.status||'Taslak');
    setValue('taxOffice',record?.taxOffice||'GÖKSUN MAL MÜDÜRLÜĞÜNE');
    setValue('subjectLine',record?.subjectLine||'Sözleşme Bedeli');
    setValue('subject',record?.subject||approval?.subject||'');
    setValue('winnerName',record?.winnerName||approval?.winnerName||'');
    setValue('workType',record?.workType||'mal/hizmet alımı');
    setValue('contractAmount',amount||'');
    setValue('stampTaxRate',record?.stampTaxRate||0.00948);
    setValue('stampTaxAmount',record?.stampTaxAmount||round2(amount*(Number(record?.stampTaxRate)||0.00948))||'');
    setValue('receiptNo',record?.receiptNo||'');
    setValue('managerName',record?.managerName||approval?.preparedName||'M. Başar SATICI');
    setValue('managerTitle',record?.managerTitle||approval?.preparedTitle||'Vakıf Müdürü');
    setValue('accountantName',record?.accountantName||'Durdu AYDIN');
    setValue('accountantTitle',record?.accountantTitle||'Muhasebe Görevlisi');
    $('#sourceNote').innerHTML=approval?`<strong>${escapeHtml(approval.documentNo||'Kaynak belge')}</strong> içindeki yüklenici: ${escapeHtml(approval.winnerName||'—')}, sözleşme bedeli: ${money(amount)}.`:'Damga vergisi için 7. aşamadaki ihale onay belgesini seçin.';
  }
  function collectDamga(){
    const approval=source();
    return {stage:'ihaleDamgaVergisi',sourceApprovalId:$('#sourceId').value,sourceApprovalNo:approval?.documentNo||editing?.sourceApprovalNo||'',sourceControlId:approval?.sourceControlId||editing?.sourceControlId||'',documentNo:$('#documentNo').value.trim(),letterDate:$('#letterDate').value,outgoingNo:$('#outgoingNo').value.trim(),status:$('#status').value,taxOffice:$('#taxOffice').value.trim(),subjectLine:$('#subjectLine').value.trim(),subject:$('#subject').value.trim(),winnerName:$('#winnerName').value.trim(),winnerAddress:approval?.winnerAddress||editing?.winnerAddress||'',workType:$('#workType').value.trim(),contractAmount:getNumber('contractAmount'),stampTaxRate:getNumber('stampTaxRate'),stampTaxAmount:getNumber('stampTaxAmount'),receiptNo:$('#receiptNo').value.trim(),managerName:$('#managerName').value.trim(),managerTitle:$('#managerTitle').value.trim(),accountantName:$('#accountantName').value.trim(),accountantTitle:$('#accountantTitle').value.trim(),items:(approval?.items||editing?.items||[]).map(item=>({...item}))};
  }
  function validateDamga(record){
    if(!record.sourceApprovalId)return 'İhale onay belgesini seçin.';
    if(!record.documentNo||!record.letterDate||!record.taxOffice||!record.subject)return 'Yazı bilgilerini eksiksiz doldurun.';
    if(!record.winnerName||record.contractAmount<=0||record.stampTaxAmount<=0)return 'Yüklenici, sözleşme bedeli ve damga vergisi tutarını doldurun.';
    if(!record.managerName||!record.managerTitle)return 'İmza bilgilerini doldurun.';
    return '';
  }

  function fillTeslim(record=null,force=false){
    const stamp=source();
    const approval=onayByStamp(stamp);
    setValue('documentNo',record?.documentNo||nextDocumentNo('TAT'));
    setValue('deliveryDate',record?.deliveryDate||today());
    setValue('status',record?.status||'Teslim Bekliyor');
    setValue('supplierName',record?.supplierName||stamp?.winnerName||'');
    setValue('subject',record?.subject||stamp?.subject||approval?.subject||'');
    setValue('itemText',record?.itemText||itemsText(approval?.items||stamp?.items||[]));
    setValue('deliveryNote',record?.deliveryNote||'');
    setValue('member1Name',record?.member1Name||approval?.member1Name||'ABDURRAHMAN GÜRBÜZ');
    setValue('member1Title',record?.member1Title||approval?.member1Title||'Sosyal Yardım ve İnceleme Görevlisi');
    setValue('member2Name',record?.member2Name||approval?.member2Name||'SITKI TURAN BOSTAN');
    setValue('member2Title',record?.member2Title||approval?.member2Title||'Sosyal Yardım ve İnceleme Görevlisi');
    setValue('member3Name',record?.member3Name||approval?.member3Name||'ÇAĞLAR ANTÜRK');
    setValue('member3Title',record?.member3Title||approval?.member3Title||'Sosyal Yardım ve İnceleme Görevlisi');
    $('#sourceNote').innerHTML=stamp?`<strong>${escapeHtml(stamp.documentNo||'Kaynak belge')}</strong> içinden ${escapeHtml(stamp.winnerName||'yüklenici')} ve ${money(stamp.contractAmount)} tutar bilgisi aktarıldı.`:'Teslim tutanağı için 8. aşamadaki damga vergisi yazısını seçin.';
  }
  function collectTeslim(){
    const stamp=source();
    const approval=onayByStamp(stamp);
    return {stage:'teslimAlmaTutanagi',sourceStampId:$('#sourceId').value,sourceStampNo:stamp?.documentNo||editing?.sourceStampNo||'',sourceApprovalId:stamp?.sourceApprovalId||editing?.sourceApprovalId||'',documentNo:$('#documentNo').value.trim(),deliveryDate:$('#deliveryDate').value,status:$('#status').value,supplierName:$('#supplierName').value.trim(),subject:$('#subject').value.trim(),itemText:$('#itemText').value.trim(),deliveryNote:$('#deliveryNote').value.trim(),contractAmount:Number(stamp?.contractAmount)||Number(editing?.contractAmount)||0,items:(approval?.items||stamp?.items||editing?.items||[]).map(item=>({...item})),member1Name:$('#member1Name').value.trim(),member1Title:$('#member1Title').value.trim(),member2Name:$('#member2Name').value.trim(),member2Title:$('#member2Title').value.trim(),member3Name:$('#member3Name').value.trim(),member3Title:$('#member3Title').value.trim()};
  }
  function validateTeslim(record){
    if(!record.sourceStampId)return 'Damga vergisi yazısını seçin.';
    if(!record.documentNo||!record.deliveryDate||!record.supplierName||!record.subject||!record.itemText)return 'Tutanak bilgilerini eksiksiz doldurun.';
    if([record.member1Name,record.member1Title,record.member2Name,record.member2Title,record.member3Name,record.member3Title].some(value=>!value))return 'Teslim alan görevli bilgilerini eksiksiz doldurun.';
    return '';
  }

  function printOnay(record){
    const date=formatDate(record.approvalDate);
    $('#printSheet').innerHTML=`<section class="print-page"><div class="print-head"><strong>T.C.</strong><strong>GÖKSUN KAYMAKAMLIĞI</strong><strong>SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI</strong></div><div class="print-title">DOĞRUDAN TEMİNLE ALIM<br>İHALE ONAY BELGESİ</div><table class="print-meta"><tr><td>İHALEYİ YAPAN İDARENİN ADI</td><td>SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI</td></tr><tr><td>BELGE TARİH VE SAYISI</td><td>${date} - ${escapeHtml(record.documentNo)}</td></tr><tr><td>MAKAM</td><td>KAYMAKAMLIK MAKAMINA</td></tr></table><div class="print-subtitle">İHALE İLE İLGİLİ BİLGİLER</div><table class="print-meta"><tr><td>İŞİN TANIMI</td><td>${escapeHtml(record.jobDefinition)}</td></tr><tr><td>İŞİN NİTELİĞİ</td><td>${escapeHtml(record.jobNature)}</td></tr><tr><td>İŞİN MİKTARI</td><td>${escapeHtml(record.quantityText)}</td></tr><tr><td>İHALE USULÜ</td><td>${escapeHtml(record.procurementMethod)}</td></tr><tr><td>YAKLAŞIK MALİYET</td><td>${plainNumber(record.estimatedCost)} TL KDV HARİÇ</td></tr><tr><td>KULLANILABİLİR ÖDENEK TUTARI</td><td>${escapeHtml(record.budgetStatus)}</td></tr></table><div class="print-subtitle">PİYASADAN FİYAT ARAŞTIRMASI YAPMAKLA GÖREVLİ PERSONEL</div><table class="print-table"><thead><tr><th>ADI SOYADI</th><th>ÜNVANI</th></tr></thead><tbody>${[1,2,3].map(index=>`<tr><td>${index}. ${escapeHtml(record[`member${index}Name`])}</td><td>${escapeHtml(record[`member${index}Title`])}</td></tr>`).join('')}</tbody></table><div class="print-subtitle">İHALE İLE İLGİLİ DİĞER AÇIKLAMALAR</div><p class="print-paragraph">${escapeHtml(record.additionalExplanation||'')}</p><div class="print-subtitle">ONAY</div><p class="print-paragraph">Yukarıda belirtilen mal/hizmetin alınması için ihaleye çıkılması hususunu onaylarınıza arz ederim.</p><div class="print-approval"><div><span>${date}</span><div class="print-space"></div><strong>${escapeHtml(record.preparedName)}</strong><span>${escapeHtml(record.preparedTitle)}</span></div><div><span>Uygundur</span><span>${date}</span><div class="print-space"></div><strong>${escapeHtml(record.finalApproverName)}</strong><span>${escapeHtml(record.finalApproverTitle)}</span></div></div></section>`;
    setTimeout(()=>window.print(),50);
  }
  function printDamga(record){
    const date=formatDate(record.letterDate);
    $('#printSheet').innerHTML=`<section class="print-page"><div class="print-head"><strong>T.C.</strong><strong>GÖKSUN KAYMAKAMLIĞI</strong><strong>SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI</strong></div><table style="width:100%;margin-top:7mm;font-size:10pt"><tr><td><strong>Sayı:</strong> ${escapeHtml(record.outgoingNo||record.documentNo)}</td><td class="number">${date}</td></tr><tr><td><strong>Konu:</strong> ${escapeHtml(record.subjectLine||'Sözleşme Bedeli')}</td><td></td></tr></table><p class="print-paragraph" style="text-align:center;font-weight:700">${escapeHtml(record.taxOffice)}</p><p class="print-paragraph">Vakfımız Başkanlığınca ihalesi yapılan <strong>${escapeHtml(record.subject)}</strong> işi ${plainNumber(record.contractAmount)} TL KDV hariç bedel ile <strong>${escapeHtml(record.winnerName)}</strong> firmasında kalmıştır. Sözleşmeye ilişkin damga vergisi bedeli olan <strong>${plainNumber(record.stampTaxAmount)} TL</strong>'nin yükleniciden alınarak makbuzunun Vakfımız bürosuna gönderilmesi konusunda,</p><p class="print-paragraph" style="text-indent:15mm">Gereğini arz ederim.</p><div style="width:45%;margin:18mm 0 0 auto;text-align:center"><strong>${escapeHtml(record.managerName)}</strong><br><span>${escapeHtml(record.managerTitle)}</span></div><div class="accountant-note">${date} ${escapeHtml(record.accountantTitle||'Muhasebe Görevlisi')} ${escapeHtml(record.accountantName||'')}</div></section>`;
    setTimeout(()=>window.print(),50);
  }
  function printTeslim(record){
    const date=formatDate(record.deliveryDate);
    $('#printSheet').innerHTML=`<section class="print-page"><div class="delivery-title">TESLİM ALMA TUTANAĞI</div><p class="print-paragraph"><strong>İşin Adı:</strong> ${escapeHtml(record.subject)}</p><p class="print-paragraph">Göksun Sosyal Yardımlaşma ve Dayanışma Vakfı ile <strong>${escapeHtml(record.supplierName)}</strong> arasında gerçekleştirilen <strong>${escapeHtml(record.itemText)}</strong> işinin teslim alma bakımından gerekli incelemeleri yapılmıştır.</p><p class="print-paragraph">Yapılan işin uygun olduğu, teslim alıma engel olabilecek eksik, kusur ve arızaların bulunmadığı görülerek <strong>${escapeHtml(record.itemText)}</strong> teslim alınmıştır. ${date}</p>${record.deliveryNote?`<p class="print-paragraph">${escapeHtml(record.deliveryNote)}</p>`:''}<div class="print-signatures">${[1,2,3].map(index=>`<div><strong>Teslim Alan</strong><div class="print-space"></div><strong>${escapeHtml(record[`member${index}Name`])}</strong><span>${escapeHtml(record[`member${index}Title`])}</span></div>`).join('')}</div></section>`;
    setTimeout(()=>window.print(),50);
  }

  renderShell();
  $('#newRecord').onclick=()=>openEditor();
  $('#cancelEdit').onclick=()=>closeEditor();
  $('#saveEdit').onclick=save;
  $('#printEdit').onclick=()=>{const record=config.collect(),message=config.validate(record);if(message){$('#formMessage').textContent=message;return}config.print(record)};
  $('#search').oninput=render;
  document.addEventListener('click',event=>{if(event.target?.id==='reloadSource'){event.preventDefault();config.fill(null,true)}});
  $('#recordList').onclick=async event=>{
    const edit=event.target.closest('[data-edit]'),print=event.target.closest('[data-print]'),del=event.target.closest('[data-delete]');
    if(edit)openEditor(records.find(record=>record.id===edit.dataset.edit));
    if(print)config.print(records.find(record=>record.id===print.dataset.print));
    if(del&&confirm('Bu kayıt kalıcı olarak silinsin mi?')){try{await api(endpoint+'/'+del.dataset.delete,{method:'DELETE'});await load()}catch(error){alert(error.message)}}
  };
  load();
})();
