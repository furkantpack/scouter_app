(function(){
  const root=document.querySelector('.person-main');
  if(!root)return;
  const cards=root.querySelectorAll('.analytics-card');
  if(cards.length===3){
    cards[0].innerHTML=`<div class="analytics-head"><h3>Referral success rate</h3><button class="analytics-more" aria-label="More options">⋯</button></div><div class="unified-hero"><strong>72%</strong><span class="positive">↑ 8%</span><small>since last month</small></div><div class="trend-chart" aria-label="Six month success rate trend"><i style="height:32%"></i><i style="height:44%"></i><i style="height:40%"></i><i style="height:58%"></i><i style="height:66%"></i><i style="height:72%"></i></div><div class="unified-legend"><span>Jan 54%</span><span>Mar 61%</span><span>Current 72%</span></div>`;
    cards[1].innerHTML=`<div class="analytics-head"><h3>Pipeline overview</h3><button class="analytics-more" aria-label="More options">⋯</button></div><div class="unified-hero"><strong>14</strong><small>Total referrals</small></div><div class="stage-breakdown"><div class="introduced"><i></i><span>Introduced</span><strong>6</strong></div><div class="interviewing"><i></i><span>Interviewing</span><strong>5</strong></div><div class="hired"><i></i><span>Hired</span><strong>3</strong></div></div>`;
    cards[2].innerHTML=`<div class="analytics-head"><h3>My network</h3><button class="analytics-more" aria-label="More options">⋯</button></div><div class="unified-hero"><strong>14</strong><span class="positive">↑ 3</span><small>network members this month</small></div><div class="stage-breakdown neutral"><div><i></i><span>Listed candidates</span><strong>9</strong></div><div><i></i><span>Open requests</span><strong>5</strong><em>↓ 1 resolved</em></div></div>`;
  }
  const facts=['↑ 3 this month','2 interviews scheduled','21% conversion rate','$800 pending'];
  root.querySelectorAll('.metric small').forEach((node,index)=>{node.textContent=facts[index];node.className=index===0?'trend-positive':'fact'});
  const stages=['Interviewing','Introduced','Interviewing','Hired'];
  const stageClasses=['interviewing','introduced','interviewing','hired'];
  const rewardStates=['Pending','Pending','Pending','Earned'];
  root.querySelectorAll('#pipeline-person .task-row').forEach((row,index)=>{
    const type=row.querySelector('.type');
    type.textContent=stages[index];type.className=`type stage ${stageClasses[index]}`;
    const reward=row.querySelector('.priority');
    const amount=reward.textContent.match(/\$[\d,]+/)?.[0]||'—';
    reward.className=`priority reward ${rewardStates[index].toLowerCase()}`;
    reward.innerHTML=`<i></i><span><b>${amount}</b> ${rewardStates[index]}</span>`;
    const more=row.querySelector('.more');more.textContent='⋯';more.setAttribute('aria-label','Candidate actions');
  });
  root.querySelectorAll('.company-logo').forEach(logo=>logo.classList.add('brand-neutral'));
  root.querySelectorAll('.company-card .company-meta strong').forEach(value=>value.innerHTML=`<small>Reward ceiling</small>${value.textContent}`);
  root.querySelectorAll('.job-reward').forEach(value=>{
    const amount=value.childNodes[0]?.textContent.trim()||value.textContent.match(/\$[\d,]+/)?.[0];
    value.innerHTML=`<small>Exact reward</small>${amount}<span>for this role</span>`;
  });
  const tagTypes=[['skill','skill','arrangement'],['domain','skill'],['domain','industry'],['skill','domain','arrangement']];
  root.querySelectorAll('.job-card').forEach((card,cardIndex)=>card.querySelectorAll('.job-tags span').forEach((tag,tagIndex)=>{
    const type=tagTypes[cardIndex]?.[tagIndex]||'skill';tag.className=type;
    if(type==='arrangement')tag.textContent=`⌂ ${tag.textContent}`;
    if(type==='domain')tag.textContent=`◆ ${tag.textContent}`;
    if(type==='industry')tag.textContent=`● ${tag.textContent}`;
  }));
  root.querySelectorAll('.section-title').forEach(header=>{
    const title=header.querySelector('h2')?.textContent||'';
    let count=header.querySelector(':scope > span');
    if(!count){count=document.createElement('span');header.querySelector('h2').after(count)}
    count.textContent=title.includes('Recommended roles')?'8':count.textContent||'12';
    const link=header.querySelector('a');if(link)link.textContent='View all →';
  });
  const companies=[
    {name:'Vercel',focus:'Developer Experience',roles:8,image:'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=700&q=85'},
    {name:'Linear',focus:'Product & Design',roles:5,image:'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=700&q=85'},
    {name:'Notion',focus:'Product & Engineering',roles:11,image:'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=700&q=85'},
    {name:'Arc',focus:'Remote Technology',roles:7,image:'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=700&q=85'},
    {name:'Stripe',focus:'Finance Infrastructure',roles:9,image:'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=700&q=85'},
    {name:'Loom',focus:'Video Collaboration',roles:6,image:'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=700&q=85'}
  ];
  const jobs={
    Vercel:[['Engineering','Build the platform developers love.','Senior Frontend Engineer','Create fast, accessible product experiences for millions of developers.','Remote, Europe','Full-time','$1,800'],['Engineering','Build the platform developers love.','Developer Experience Engineer','Help teams adopt modern web workflows and improve developer tooling.','United States','Full-time','$1,500'],['Product & Design','Shape intuitive infrastructure products.','Senior Product Designer','Design clear workflows for complex deployment and collaboration tools.','Remote','Full-time','$1,200']],
    Linear:[['Product & Design','Craft focused tools for modern teams.','Senior Product Designer','Design elegant planning experiences used by high-performing product teams.','Remote','Full-time','$1,200'],['Engineering','Make software feel magical.','UI Engineer','Build polished interfaces with exceptional performance and interaction quality.','Europe','Full-time','$1,400']],
    Notion:[['Product','Make knowledge and work more connected.','Product Manager, Growth','Develop experiments that help teams discover and adopt connected workflows.','San Francisco / Remote','Full-time','$2,000'],['Engineering','Build flexible tools for every team.','Backend Engineer','Scale collaborative systems and reliable data infrastructure.','United States','Full-time','$1,800']],
    Arc:[['Data & Platform','Power distributed technology teams.','Data Platform Engineer','Build dependable pipelines and analytics foundations for global talent products.','Remote, Global','Full-time','$1,500'],['Customer Experience','Help talent and companies succeed.','Support Specialist','Resolve product issues and improve the hiring experience for remote teams.','Remote','Full-time','$900']],
    Stripe:[['Finance Engineering','Grow the economic infrastructure of the internet.','Payments Engineer','Build reliable payment systems used by ambitious global businesses.','United States','Full-time','$2,200'],['Data & Insights','Turn payment data into decisions.','Research Analyst','Uncover product and market insights across a global financial network.','New York / Remote','Full-time','$1,600']],
    Loom:[['Product & Growth','Make work communication effortless.','Growth Manager','Create product-led strategies that expand adoption across modern teams.','Remote','Full-time','$1,300'],['Engineering','Build the future of async video.','Media Engineer','Improve video capture, processing, playback, and reliability at scale.','United States','Full-time','$1,700']]
  };
  const companySection=root.querySelector('#companies');
  const jobsSection=root.querySelector('#jobs');
  if(companySection&&jobsSection){
    companySection.innerHTML=`<div class="company-explorer-head"><span>Companies in your network</span><h2>Explore teams hiring trusted referrals</h2><p>Select a company to view its open positions and exact referral rewards.</p></div><div class="company-showcase">${companies.map((company,index)=>`<button class="showcase-card${index===0?' selected':''}" data-company="${company.name}" style="--company-image:url('${company.image}')"><span class="showcase-overlay"></span><span class="showcase-copy"><strong>${company.name}</strong><small>${company.focus}</small><em>${company.roles} open roles</em></span></button>`).join('')}</div><div class="company-explorer-foot"><span>Verified companies actively hiring from trusted networks.</span><button type="button" class="explore-all">Explore all companies ↗</button></div>`;
    jobsSection.className='positions-panel';
    const renderPositions=name=>{
      const rows=jobs[name]||jobs.Vercel;
      const groups=[...new Set(rows.map(row=>row[0]))];
      jobsSection.innerHTML=`<div class="careers08"><div class="careers08-inner"><header class="careers08-head"><span class="careers08-badge">Join ${name}</span><h2>Join us in shaping tomorrow’s work</h2><p>Create solutions that empower people and businesses worldwide.</p></header><div class="careers08-categories">${groups.map(group=>{const matches=rows.filter(row=>row[0]===group);return `<section class="careers08-category"><div class="careers08-category-copy"><h3>${group}</h3><p>${matches[0][1]}</p></div><div class="careers08-jobs">${matches.map(row=>`<article class="position-row careers08-job"><strong>${row[2]}</strong><div class="careers08-meta"><span><i>◎</i>${row[4]}</span><b>·</b><span><i>◷</i>${row[5]}</span></div><button type="button" aria-label="View ${row[2]}">↗</button></article>`).join('')}</div></section>`}).join('')}<div class="careers08-more"><span class="careers08-mark">⬡</span><p>Looking for more opportunities to grow?</p><button type="button">Explore all positions <i>↗</i></button></div></div></div></div>`;
    };
    companySection.querySelectorAll('.showcase-card').forEach(card=>card.addEventListener('click',()=>{
      location.href=`/company/${card.dataset.company.toLowerCase().replace(/\s+/g,'-')}/`;
    }));
    renderPositions('Vercel');
  }
})();
