(function(){
  const shell=document.querySelector('.candidate-drawer-overlay');
  if(!shell)return;
  const steps=[...shell.querySelectorAll('.drawer-step')];
  const panels=[...shell.querySelectorAll('.drawer-panel')];
  const back=shell.querySelector('#drawerBack');
  const next=shell.querySelector('#drawerNext');
  let sent=false;

  function current(){return panels.findIndex(panel=>panel.classList.contains('active'))}
  function sync(){
    const active=current();
    steps.forEach((step,index)=>{
      step.classList.toggle('available',index<=2||sent);
      step.setAttribute('aria-current',index===active?'step':'false');
      step.setAttribute('aria-disabled',index===3&&!sent?'true':'false');
    });
  }
  function goTo(target){
    if(target===3&&!sent)return;
    let active=current();
    while(active>target){back.click();active=current()}
    while(active<target){
      next.click();
      active=current();
      if(active===3)sent=true;
    }
    sync();
  }
  steps.forEach((step,index)=>{
    step.setAttribute('role','button');
    step.tabIndex=0;
    step.addEventListener('click',()=>goTo(index));
    step.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();goTo(index)}
    });
  });
  next.addEventListener('click',()=>setTimeout(()=>{if(current()===3)sent=true;sync()},0));
  new MutationObserver(sync).observe(shell,{attributes:true,subtree:true,attributeFilter:['class']});
  sync();
})();
