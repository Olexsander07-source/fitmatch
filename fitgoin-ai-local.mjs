// Local discovery is opt-in. Merchant prices and memberships are not invented.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={
 ru:{tab:'Рядом 15 км',title:'Спорт и питание рядом',intro:'Залы, спортмагазины и супермаркеты в радиусе 15 км от центра выбранного города. Геолокация телефона не нужна.',city:'Город и страна',go:'Найти рядом',consent:'Разрешаю передать этот город в Google Maps для данного поиска.',off:'Поиск пока выключен: требуется настройка Google Maps Platform. Тренировки и питание продолжают работать.',gyms:'Залы',equipment:'Спортмагазины',groceries:'Продуктовые',empty:'Места в указанном радиусе не найдены.',price:'Цена не подтверждена',note:'Расстояние по прямой от центра города, не время пути. Адреса из Google Maps; тарифы, цены и наличие товаров отдельно не проверены.',source:'Открыть в Google Maps',checked:'Проверено'},
 fr:{tab:'À proximité 15 km',title:'Sport et courses à proximité',intro:'Salles, magasins de sport et supermarchés à 15 km du centre-ville choisi, sans géolocalisation du téléphone.',city:'Ville et pays',go:'Rechercher',consent:'J’accepte de transmettre cette ville à Google Maps pour cette recherche.',off:'Recherche indisponible : configuration Google Maps requise. Vos plans restent accessibles.',gyms:'Salles de sport',equipment:'Magasins de sport',groceries:'Supermarchés',empty:'Aucun lieu trouvé dans ce rayon.',price:'Prix non vérifié',note:'Distance à vol d’oiseau depuis le centre-ville. Lieux issus de Google Maps; prix et stocks non vérifiés.',source:'Voir dans Google Maps',checked:'Vérifié le'},
 en:{tab:'Nearby 15 km',title:'Fitness and groceries nearby',intro:'Find gyms, equipment shops and supermarkets within 15 km of a city centre without phone location access.',city:'City and country',go:'Find nearby',consent:'I agree to send this city to Google Maps for this search.',off:'Search is disabled until Google Maps is configured. Your plans remain available.',gyms:'Gyms',equipment:'Sports stores',groceries:'Grocery stores',empty:'No places found in this radius.',price:'Price not verified',note:'Straight-line radius, not travel time. Locations sourced from Google Maps; prices and stock not verified.',source:'Open in Google Maps',checked:'Checked'}
};
export const localLabel=(lang='fr')=>(labels[lang]||labels.fr).tab;
export function localDiscoveryHTML({city='',language='fr',ready=false,result=null}={}) {
 const s=labels[language]||labels.fr;
 const types=[['gyms',s.gyms],['equipment',s.equipment],['groceries',s.groceries]];
 const rows=Array.isArray(result?.results)?result.results:[];
 const cards=rows.map(x=>[
   '<article class="panel fgi-local-place"><h3>',esc(x.name),'</h3><p>',esc(x.address),
   '</p><p class="hint">',esc(x.distance_km),' km · ',s.price,'</p>',
   x.maps_url?'<a href="'+esc(x.maps_url)+'" target="_blank" rel="noopener noreferrer">'+s.source+'</a>':'',
   '</article>'
 ].join('')).join('');
 const form=ready?[
   '<form data-ai-form="local" class="panel fgi-local-form">',
   '<label>',s.city,'<input name="city" required maxlength="100" autocomplete="address-level2" value="',esc(city),'" placeholder="Toulouse, France"></label>',
   '<label><select name="category">',
   types.map(x=>'<option value="'+x[0]+'"'+(result?.category===x[0]?' selected':'')+'>'+x[1]+'</option>').join(''),
   '</select></label>',
   '<label class="fgi-ai-check"><input type="checkbox" name="consent" required> ',s.consent,'</label>',
   '<button type="submit" class="btn primary">',s.go,'</button></form>'
 ].join(''):'<p class="hint" role="status">'+s.off+'</p>';
 const found=result?[
   '<h3>',esc(result.city),' · ',esc(result.radius_km),' km</h3>',
   rows.length?'<div class="fgi-local-results">'+cards+'</div>':'<p>'+s.empty+'</p>',
   '<p class="hint">',s.note,'</p><p class="hint">',s.checked,': ',
   esc(String(result.checked_at||'').slice(0,16)),' · Google Maps Platform</p>'
 ].join(''):'';
 return '<section class="fgi-local" data-ai-local><h2>'+s.title+'</h2><p>'+s.intro+'</p>'+form+found+'</section>';
}
