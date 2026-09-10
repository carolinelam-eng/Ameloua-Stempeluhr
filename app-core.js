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
    return (schedules||[]).filter(s=>s.employeeId===employeeId&&sourceDates.includes(s.date)).map(s=>({employeeId,date:addDays(targetMonday,sourceDates.indexOf(s.date)),start:s.start||'',targetMinutes:Number(s.targetMinutes)||0})).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function parseDuration(text){
    const t=String(text||'').trim().replace(',',':');
    if(/^\d{1,2}:\d{1,2}$/.test(t)){const [h,m]=t.split(':').map(Number);if(m<60)return h*60+m;}
    const n=Number(t.replace(':','.')); if(Number.isFinite(n)&&n>=0)return Math.round(n*60); return null;
  }
  function durationText(minutes){minutes=Math.max(0,Number(minutes)||0);return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;}
  function makeBackup(state,createdAt){return {backupFormat:'ameloua-timeclock-backup',backupVersion:2,createdAt,state};}
  return {timeToMinutes,minutesBetweenTimes,formatMinutes,differenceMinutes,formatDifference,getSchedule,sumScheduledMinutes,copyWeekSchedules,parseDuration,durationText,addDays,makeBackup};
});
