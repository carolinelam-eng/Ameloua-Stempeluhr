(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.AppCore=api;
})(typeof self!=='undefined'?self:this,function(){
  function timeToMinutes(t){
    if(!t||!/^[0-2]\d:[0-5]\d$/.test(t)) return null;
    const [h,m]=t.split(':').map(Number); if(h>23)return null; return h*60+m;
  }
  function minutesBetweenTimes(a,b){
    const x=timeToMinutes(a),y=timeToMinutes(b); if(x==null||y==null)return null; return y>=x?y-x:(1440-x+y);
  }
  function formatMinutes(m){
    m=Math.max(0,Math.round(Number(m)||0));
    return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')} h`;
  }
  function differenceMinutes(actual,target){return Math.round((Number(actual)||0)-(Number(target)||0));}
  function formatDifference(m){
    m=Math.round(Number(m)||0); const sign=m>0?'+':m<0?'-':''; const a=Math.abs(m);
    return `${sign}${Math.floor(a/60)}:${String(a%60).padStart(2,'0')} h`;
  }
  function getSchedule(schedules,employeeId,date){return (schedules||[]).find(s=>s.employeeId===employeeId&&s.date===date)||null;}
  function sumScheduledMinutes(schedules,employeeId,month){return (schedules||[]).filter(s=>(!employeeId||s.employeeId===employeeId)&&(!month||s.date.slice(0,7)===month)).reduce((n,s)=>n+(Number(s.targetMinutes)||0),0);}
  function addDays(dateStr,days){const d=new Date(dateStr+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
  function copyWeekSchedules(schedules,employeeId,sourceMonday,targetMonday){
    const sourceDates=Array.from({length:7},(_,i)=>addDays(sourceMonday,i));
    return (schedules||[]).filter(s=>s.employeeId===employeeId&&sourceDates.includes(s.date)).map(s=>({employeeId,date:addDays(targetMonday,sourceDates.indexOf(s.date)),start:s.start||'',targetMinutes:Number(s.targetMinutes)||0,absenceType:s.absenceType||'arbeit'})).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function parseDuration(text){
    const t=String(text||'').trim().replace(',',':');
    if(/^\d{1,2}:\d{1,2}$/.test(t)){const [h,m]=t.split(':').map(Number);if(m<60)return h*60+m;}
    const n=Number(t.replace(':','.')); if(Number.isFinite(n)&&n>=0)return Math.round(n*60); return null;
  }
  function durationText(minutes){minutes=Math.max(0,Number(minutes)||0);return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;}

  function normalizeScheduleInput(start,duration){
    const st=String(start||'').trim(), raw=String(duration||'').trim();
    const mins=raw===''?0:parseDuration(raw);
    if(!st && (raw==='' || mins===0)) return {kind:'free'};
    if(!st || mins==null || mins<=0) return {kind:'invalid'};
    if(timeToMinutes(st)==null) return {kind:'invalid'};
    return {kind:'work',start:st,targetMinutes:mins};
  }
  function absenceCreditMinutes(type,targetMinutes){
    const paid=['krank','urlaub','feiertag','schule'];
    return paid.includes(String(type||'arbeit'))?Math.max(0,Number(targetMinutes)||0):0;
  }
  function dayDifferenceMinutes(actualMinutes,targetMinutes,absenceType){
    return Math.round((Number(actualMinutes)||0)+absenceCreditMinutes(absenceType,targetMinutes)-(Number(targetMinutes)||0));
  }
  function correctionSnapshot(value){
    return {start:value&&value.start||null,end:value&&value.end||null,pauseMinutes:Math.max(0,Number(value&&value.pauseMinutes)||0)};
  }

  function createManualEntryData({employeeId,date,start,end,pauseMinutes=0,reason='',entryId,timestamp}){
    const sd=new Date(`${date}T${start}:00`);
    const ed=end?new Date(`${date}T${end}:00`):null;
    const pm=Math.max(0,Number(pauseMinutes)||0);
    const time=timestamp||new Date().toISOString();
    const id=entryId||`manual_${Date.now()}`;
    const entry={id,employeeId,start:sd.toISOString(),end:ed?ed.toISOString():null,pauses:pm?[{id:`${id}_pause`,start:sd.toISOString(),end:new Date(sd.getTime()+pm*60000).toISOString(),manual:true}]:[],createdAt:time,updatedAt:time,correctionReason:reason};
    const after=correctionSnapshot({start:entry.start,end:entry.end,pauseMinutes:pm});
    const audit={id:`${id}_audit`,type:'manual_correction',employeeId,entryId:id,time,reason,before:null,after};
    return {entry,audit};
  }

  function monthlyExportModel(rows,month,employeeId){
    const filtered=(rows||[]).filter(r=>(!month||String(r.date||'').slice(0,7)===month)&&(!employeeId||r.employeeId===employeeId));
    const totals=filtered.reduce((t,r)=>({
      target:t.target+(Number(r.target)||0),
      actual:t.actual+(Number(r.actual)||0),
      pause:t.pause+(Number(r.pause)||0),
      credit:t.credit+(Number(r.credit)||0),
      diff:t.diff+(Number(r.diff)||0)
    }),{target:0,actual:0,pause:0,credit:0,diff:0});
    return {rows:filtered,totals};
  }

  function renameEmployee(employees,id,newName){
    const name=String(newName||'').trim();
    if(!name) return (employees||[]).map(e=>({...e}));
    return (employees||[]).map(e=>e.id===id?{...e,name}:({...e}));
  }

  function personalOverviewModel({employeeId,today,schedules=[],days=[]}){
    const monday=addDays(today,-((new Date(today+'T12:00:00').getDay()||7)-1));
    const weekDays=Array.from({length:7},(_,i)=>{
      const date=addDays(monday,i), sc=getSchedule(schedules,employeeId,date), day=days.find(d=>d.date===date)||{};
      const target=Number(sc&&sc.targetMinutes)||0, actual=Number(day.actualMinutes)||0, pause=Number(day.pauseMinutes)||0;
      const credit=absenceCreditMinutes(sc&&sc.absenceType,target), diff=actual+credit-target;
      return {date,target,actual,pause,credit,diff,absenceType:sc&&sc.absenceType||'arbeit'};
    });
    const total=rows=>rows.reduce((t,r)=>({target:t.target+r.target,actual:t.actual+r.actual,pause:t.pause+r.pause,credit:t.credit+r.credit,diff:t.diff+r.diff}),{target:0,actual:0,pause:0,credit:0,diff:0});
    const todayRow=weekDays.find(r=>r.date===today)||{target:0,actual:0,pause:0,credit:0,diff:0};
    return {today:{target:todayRow.target,actual:todayRow.actual,pause:todayRow.pause,credit:todayRow.credit,diff:todayRow.diff},week:total(weekDays),weekDays};
  }

  function makeBackup(state,createdAt){return {backupFormat:'ameloua-timeclock-backup',backupVersion:2,createdAt,state};}
  return {timeToMinutes,minutesBetweenTimes,formatMinutes,differenceMinutes,formatDifference,getSchedule,sumScheduledMinutes,copyWeekSchedules,parseDuration,durationText,addDays,normalizeScheduleInput,absenceCreditMinutes,dayDifferenceMinutes,correctionSnapshot,createManualEntryData,monthlyExportModel,renameEmployee,personalOverviewModel,makeBackup};
});
