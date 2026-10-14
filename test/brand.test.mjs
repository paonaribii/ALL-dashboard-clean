import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';

test('every tab, drill scope and export use the selected brand and month', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const payload = JSON.parse(gunzipSync(await readFile(new URL('../data/dashboard.json.gz', import.meta.url))));
  let exported;
  const context = vm.createContext({
    payload, Blob, setTimeout, clearTimeout,
    URL:{createObjectURL(blob){exported=blob;return 'blob:test'},revokeObjectURL(){}},
    document:{addEventListener(){},getElementById(){return {textContent:''}},createElement(){return {click(){}}}},
    window:{addEventListener(){}},
  });
  vm.runInContext(script.slice(0,script.indexOf("$('resetBtn').onclick")),context);
  vm.runInContext(`
    full=rowsToObjects(payload.contractHeaders,payload.contractRows);
    noFull=rowsToObjects(payload.noContractHeaders,payload.noContractRows);
    ALL_FILTERS.forEach(([field])=>state[field]=new Set());
    globalThis.seen=[];
    renderGlobalBrandFilter=()=>{};renderQuality=()=>{};renderMergeCaveats=()=>{};tidyHero=()=>{};tidyStatus=()=>{};
    buildYoyMaps=()=>({});
    for(const name of ['renderHero','renderMdm','renderMdmDimension','renderAppleProductCard','renderProducts','renderBranch','renderDimension','renderOrgSummary','renderStatus','renderStatusAudit','renderBars','renderDueTop10','renderK2Year','renderDetail']){
      globalThis[name]=(rows)=>seen.push({name,count:totals(rows).contracts,brands:[...new Set(rows.map(r=>r.BRAND))]});
    }
    renderTrend=()=>{};renderNoContract=()=>{};
  `,context);
  const objects = payload.contractRows.map(r=>Object.fromEntries(payload.contractHeaders.map((h,i)=>[h,r[i]])));
  const brands=[...new Set(objects.map(r=>r.BRAND))];
  for(const brand of brands){
    context.chosen=brand;
    const expected=objects.filter(r=>r.BRAND===brand).reduce((s,r)=>s+Number(r.CONTRACTS||0),0);
    vm.runInContext(`sharedFilters.brands=new Set([canonicalBrand(chosen)]);state.BRAND=new Set([chosen]);seen=[];for(const tab of ['ufund','mdm','brand','dimension','rm','am']){activeTab=tab;render()}`,context);
    for(const result of context.seen){assert.equal(result.count,expected,`${brand} ${result.name}`);assert.ok(result.brands.every(b=>b===brand));}
    assert.ok(vm.runInContext("filteredIgnoringFields(['BRAND','MODEL']).every(r=>canonicalBrand(r.BRAND)===canonicalBrand(chosen))",context));
    assert.ok(vm.runInContext('filteredNoContract().every(r=>canonicalBrand(r.BRAND)===canonicalBrand(chosen))',context));
  }
  context.chosen=brands.find(b=>/apple/i.test(b))||brands[0];
  vm.runInContext("sharedFilters.brands=new Set([canonicalBrand(chosen)]);state.BRAND=new Set([chosen]);rangeStart='2026-07';rangeEnd='2026-07';exportCsv()",context);
  const expectedJuly=objects.filter(r=>r.BRAND===context.chosen && r.MONTH==='2026-07');
  assert.equal(vm.runInContext('filtered().length',context),expectedJuly.length);
  const csv=await exported.text();
  assert.equal(csv.split('\n').length-1,expectedJuly.length);
  vm.runInContext("clearSharedFilters();state.BRAND.clear();rangeStart='';rangeEnd=''",context);
  assert.equal(vm.runInContext('totals(filtered()).contracts',context),601056);
  vm.runInContext("sharedFilters.brands=new Set(['OPPO','vivo']);sharedFilters.fields.MONTH='2026-07'",context);
  const multi=objects.filter(r=>['oppo','vivo'].includes(String(r.BRAND).toLowerCase())&&r.MONTH==='2026-07');
  assert.equal(vm.runInContext('totals(filtered()).contracts',context),multi.reduce((s,r)=>s+Number(r.CONTRACTS||0),0));
  vm.runInContext("sharedFilters.shops=new Set(['BaNANA','Studio7'])",context);
  assert.equal(vm.runInContext('totals(filtered()).contracts',context),multi.filter(r=>['BaNANA','Studio7'].includes(r.CHANNEL_TYPE)).reduce((s,r)=>s+Number(r.CONTRACTS||0),0));
  const categories=vm.runInContext('productCategories.map(category=>totals(full.filter(r=>sharedRow(r).CATEGORY===category)).contracts)',context);
  assert.equal(categories.reduce((a,b)=>a+b,0),601056);
  for(const [brand,model,group,expected] of [['Apple','iPad Pro','Tablet','iPad'],['Samsung','Galaxy Tab','Tablet','Tablet'],['Apple','MacBook Air','Laptop','Mac'],['ASUS','Vivobook','Laptop','Notebook'],['Apple','iPhone 15','iPhone','iPhone'],['OPPO','A5','Smartphone','Smartphone']]){
    context.sample={BRAND:brand,MODEL:model,PRODUCT_GROUP:group};assert.equal(vm.runInContext('sharedRow(sample).CATEGORY',context),expected);
  }
});
