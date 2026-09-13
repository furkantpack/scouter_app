export interface OnboardingQuestion {id:string;question_key:string;section_key:string;section_title:string;question:string;input_type:string;options:unknown;sort_order:number;is_required:boolean;}
export function questionOptions(question:OnboardingQuestion):{value:string;label:string}[]{
 if(!Array.isArray(question.options))return [];
 return question.options.map(option=>typeof option==='string'?{value:option,label:option}:option&&typeof option==='object'&&'value' in option&&'label' in option?{value:String(option.value),label:String(option.label)}:null).filter((option):option is {value:string;label:string}=>option!==null);
}
export const multiQuestion=(question:OnboardingQuestion)=>['multi_select','multiselect','multi_choice','checkbox','checkboxes'].includes(question.input_type);
export function validateAnswer(question:OnboardingQuestion,value:unknown):boolean{
 if(value===undefined||value===null||value===''||(Array.isArray(value)&&value.length===0))return !question.is_required;
 const options=questionOptions(question);
 if(multiQuestion(question))return Array.isArray(value)&&value.length<=options.length&&new Set(value).size===value.length&&value.every(v=>typeof v==='string'&&options.some(o=>o.value===v));
 if(typeof value!=='string'||value.length>10000)return false;
 if(options.length)return options.some(o=>o.value===value);
 if(question.input_type==='url'){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}}
 if(question.input_type==='number')return Number.isFinite(Number(value));
 return value.trim().length>0||!question.is_required;
}
