const MONTH_NAMES_TH=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
function setCustomDayRange(start,end,preset='CUSTOM'){delete sharedFilters.fields.MONTH;rangeMode='DAY';rangeStart=start;rangeEnd=end;rangePreset=preset;if(rangeStart&&rangeEnd&&rangeStart>rangeEnd){const swap=rangeStart;rangeStart=rangeEnd;rangeEnd=swap}syncDateControls();scheduleRender()}
function populateDayRangeSelects(){
  if($('rangeStartDay').dataset.populated)return;
  const years=[...new Set(full.map(r=>String(r.YEAR)).filter(y=>/^\d{4}$/.test(y)))].sort();
  const dayOpts='<option value="">วัน</option>'+Array.from({length:31},(_,i)=>String(i+1).padStart(2,'0')).map(d=>`<option value="${d}">${Number(d)}</option>`).join('');
  const monthOpts='<option value="">เดือน</option>'+MONTH_NAMES_TH.map((name,i)=>`<option value="${String(i+1).padStart(2,'0')}">${name}</option>`).join('');
  const yearOpts='<option value="">ปี</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
  ['rangeStartDay','rangeEndDay'].forEach(id=>$(id).innerHTML=dayOpts);
  ['rangeStartMonth','rangeEndMonth'].forEach(id=>$(id).innerHTML=monthOpts);
  ['rangeStartYear','rangeEndYear'].forEach(id=>$(id).innerHTML=yearOpts);
  const onChange=()=>{
    const sd=$('rangeStartDay').value,sm=$('rangeStartMonth').value,sy=$('rangeStartYear').value;
    const ed=$('rangeEndDay').value,em=$('rangeEndMonth').value,ey=$('rangeEndYear').value;
    const start=sy&&sm&&sd?`${sy}-${sm}-${sd}`:'';
    const end=ey&&em&&ed?`${ey}-${em}-${ed}`:'';
    setCustomDayRange(start,end);
  };
  ['rangeStartDay','rangeStartMonth','rangeStartYear','rangeEndDay','rangeEndMonth','rangeEndYear'].forEach(id=>$(id).onchange=onChange);
  $('rangeStartDay').dataset.populated='1';
}
function syncDayRangeSelects(){
  const setSel=(prefix,value)=>{
    let y='',m='',d='';
    if(/^\d{4}-\d{2}-\d{2}$/.test(value||'')){[y,m,d]=value.split('-')}
    else if(/^\d{4}-\d{2}$/.test(value||'')){[y,m]=value.split('-')}
    if($(prefix+'Year'))$(prefix+'Year').value=y;
    if($(prefix+'Month'))$(prefix+'Month').value=m;
    if($(prefix+'Day'))$(prefix+'Day').value=d;
  };
  setSel('rangeStart',rangeStart);setSel('rangeEnd',rangeEnd);
}
