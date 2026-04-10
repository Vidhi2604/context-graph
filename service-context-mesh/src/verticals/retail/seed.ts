import { runQuery } from "@/lib/neo4j";
import { v4 as uuidv4 } from "uuid";

const CITIES = ["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow"];
const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];
const TIER_W = [0.35, 0.30, 0.25, 0.10];
const PAYMENTS = ["COD", "UPI", "Credit Card", "Debit Card"];
const PAYMENT_W = [0.30, 0.35, 0.20, 0.15];
const CHANNELS = ["app", "web", "app", "web", "mobile"];

const PRODUCTS = [
  { product_id: "nike_air_max", name: "Nike Air Max", category: "Footwear", brand: "Nike", price: 8499 },
  { product_id: "adidas_ultraboost", name: "Adidas Ultraboost", category: "Footwear", brand: "Adidas", price: 12999 },
  { product_id: "puma_rsx", name: "Puma RS-X", category: "Footwear", brand: "Puma", price: 6499 },
  { product_id: "converse_chuck", name: "Converse Chuck Taylor", category: "Footwear", brand: "Converse", price: 3999 },
  { product_id: "nike_pegasus", name: "Nike Pegasus 40", category: "Footwear", brand: "Nike", price: 9999 },
  { product_id: "skechers_go", name: "Skechers Go Walk", category: "Footwear", brand: "Skechers", price: 3499 },
  { product_id: "bata_casual", name: "Bata Casual Sneaker", category: "Footwear", brand: "Bata", price: 1999 },
  { product_id: "levis_jacket", name: "Levis Denim Jacket", category: "Apparel", brand: "Levis", price: 4599 },
  { product_id: "uspolo_shirt", name: "U.S. Polo Shirt", category: "Apparel", brand: "U.S. Polo", price: 1899 },
  { product_id: "hm_hoodie", name: "H&M Oversized Hoodie", category: "Apparel", brand: "H&M", price: 2499 },
  { product_id: "zara_tshirt", name: "Zara Basic T-Shirt", category: "Apparel", brand: "Zara", price: 1299 },
  { product_id: "tommy_polo", name: "Tommy Hilfiger Polo", category: "Apparel", brand: "Tommy", price: 3499 },
  { product_id: "mango_dress", name: "Mango Floral Dress", category: "Apparel", brand: "Mango", price: 2999 },
  { product_id: "wrogn_tshirt", name: "WROGN Graphic Tee", category: "Apparel", brand: "WROGN", price: 799 },
  { product_id: "allen_solly", name: "Allen Solly Formal Shirt", category: "Apparel", brand: "Allen Solly", price: 1599 },
  { product_id: "fossil_watch", name: "Fossil Watch", category: "Accessories", brand: "Fossil", price: 7999 },
  { product_id: "rayban_aviator", name: "Ray-Ban Aviator", category: "Accessories", brand: "Ray-Ban", price: 5999 },
  { product_id: "wildcraft_backpack", name: "Wildcraft Backpack 40L", category: "Accessories", brand: "Wildcraft", price: 2299 },
  { product_id: "fastrack_watch", name: "Fastrack Sports Watch", category: "Accessories", brand: "Fastrack", price: 1899 },
  { product_id: "caprese_bag", name: "Caprese Tote Bag", category: "Accessories", brand: "Caprese", price: 3299 },
  { product_id: "titan_watch", name: "Titan Edge Watch", category: "Accessories", brand: "Titan", price: 6999 },
  { product_id: "boat_earphones", name: "boAt Airdopes 141", category: "Accessories", brand: "boAt", price: 1299 },
];

const AGENTS = [
  { agent_id: "agent_ravi", name: "Ravi K.", role: "L2 Support", team: "Returns" },
  { agent_id: "agent_anita", name: "Anita S.", role: "L1 Support", team: "General" },
  { agent_id: "agent_deepak", name: "Deepak M.", role: "L2 Support", team: "Returns" },
  { agent_id: "agent_priya_r", name: "Priya R.", role: "L1 Support", team: "General" },
  { agent_id: "agent_vikram", name: "Vikram T.", role: "Manager", team: "Returns" },
  { agent_id: "agent_sneha", name: "Sneha L.", role: "L1 Support", team: "Payments" },
  { agent_id: "agent_rahul_d", name: "Rahul D.", role: "L2 Support", team: "Escalations" },
];

const POLICIES = [
  { id: "return_v3.1", name: "Return Policy", ver: "v3.1", rule: "30-day return, exceptions require manager", status: "superseded" },
  { id: "return_v3.2", name: "Return Policy", ver: "v3.2", rule: "30-day return window, strict", status: "active" },
  { id: "refund_v2.1", name: "Refund Policy", ver: "v2.1", rule: "7-day processing", status: "active" },
  { id: "cod_v4.0", name: "COD Policy", ver: "v4.0", rule: "Available under Rs.15,000", status: "active" },
  { id: "exchange_v1.0", name: "Exchange Policy", ver: "v1.0", rule: "Size exchange within 15 days", status: "active" },
];

const FIRST = ["Priya","Rahul","Sneha","Arjun","Meera","Vikram","Kavita","Amit","Neha","Suresh","Deepika","Rohit","Anjali","Karthik","Pooja","Sanjay","Divya","Aditya","Shreya","Rajesh","Ananya","Vikas","Sunita","Mohan","Lakshmi","Arun","Ritu","Mahesh","Nisha","Gaurav","Archana","Sunil","Preeti","Nitin","Usha","Ashok","Smita","Rajan","Rekha","Vivek","Geeta","Pramod","Jyoti","Sushil","Shweta","Hemant","Vandana","Pankaj","Kavitha","Nikhil"];
const LAST = ["Sharma","Patel","Reddy","Kumar","Singh","Iyer","Nair","Gupta","Shah","Joshi","Pillai","Rao","Menon","Desai","Verma","Chopra","Bose","Mehta","Agarwal","Mishra","Tiwari","Pandey","Sinha","Yadav","Chauhan","Malhotra","Bhat","Kaur","Naik","Das"];
const RETURN_REASONS = {
  Footwear: ["size_runs_small","size_runs_large","quality_not_as_expected","colour_different","damaged_product"],
  Apparel: ["size_mismatch","colour_different","fabric_quality_poor","defective_product","wrong_item_delivered"],
  Accessories: ["product_not_working","damaged_in_transit","quality_not_as_expected","not_as_described","wrong_item"],
};
const ISSUES = ["delivery_delay","wrong_item_delivered","refund_not_received","sizing_issue","product_defect","payment_failure"];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function wPick<T>(a: T[], w: number[]): T { let c = 0; const r = Math.random(); for (let i = 0; i < a.length; i++) { c += w[i]; if (r < c) return a[i]; } return a[a.length-1]; }
function ri(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min; }
function da(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString(); }

type JT = "happy"|"cart_abandon"|"return"|"support"|"repeat"|"churned"|"seasonal"|"browse";
function journey(tier: string): JT {
  const r = Math.random();
  if (tier==="Platinum") return r<0.45?"repeat":r<0.70?"happy":r<0.85?"return":"support";
  if (tier==="Gold")     return r<0.30?"happy":r<0.52?"repeat":r<0.70?"return":r<0.85?"support":"cart_abandon";
  if (tier==="Silver")   return r<0.22?"happy":r<0.42?"cart_abandon":r<0.58?"return":r<0.70?"seasonal":r<0.82?"support":"browse";
  return r<0.12?"happy":r<0.32?"cart_abandon":r<0.50?"browse":r<0.65?"seasonal":r<0.78?"churned":"return";
}

export async function seedRetail(tenantId: string): Promise<{profiles:number;events:number}> {
  let ev = 0; const T = tenantId;

  for (const p of PRODUCTS) await runQuery(`MERGE (x:Product {product_id:$pid,_tenant:$t}) ON CREATE SET x.name=$n,x.category=$c,x.brand=$b,x.price=$p`,{pid:p.product_id,t:T,n:p.name,c:p.category,b:p.brand,p:p.price});
  for (const a of AGENTS) await runQuery(`MERGE (x:Agent {agent_id:$aid,_tenant:$t}) ON CREATE SET x.name=$n,x.role=$r,x.team=$tm`,{aid:a.agent_id,t:T,n:a.name,r:a.role,tm:a.team});
  for (const p of POLICIES) await runQuery(`MERGE (x:Policy {policy_id:$pid,_tenant:$t}) ON CREATE SET x.name=$n,x.version=$v,x.rule_summary=$r,x.status=$s`,{pid:p.id,t:T,n:p.name,v:p.ver,r:p.rule,s:p.status});
  await runQuery(`MATCH (a:Policy {policy_id:'return_v3.1',_tenant:$t}) MATCH (b:Policy {policy_id:'return_v3.2',_tenant:$t}) MERGE (a)-[:SUPERSEDED_BY]->(b)`,{t:T});

  for (let i = 0; i < 200; i++) {
    const fName = FIRST[i % FIRST.length];
    const lName = LAST[Math.floor(i/FIRST.length) % LAST.length];
    const name = `${fName} ${lName}`;
    const tier = wPick(TIERS, TIER_W);
    const city = CITIES[i % CITIES.length];
    const ltv = tier==="Platinum"?ri(200000,500000):tier==="Gold"?ri(80000,200000):tier==="Silver"?ri(20000,80000):ri(1000,20000);
    const pid = `prof_r_${String(i+1).padStart(3,"0")}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${i}@testmail.com`;
    const phone = `${9800000000+i}`;

    await runQuery(`CREATE (p:Profile {profile_id:$pid,name:$name,tier:$tier,city:$city,ltv:$ltv,_tenant:$t,_vertical:'retail',created_at:datetime()})`,{pid,name,tier,city,ltv,t:T});
    await runQuery(`MATCH (p:Profile {profile_id:$pid,_tenant:$t}) CREATE (i1:Identity {identity_id:$id1,type:'email',value:$email,source:'app_sdk',strength:'strong',verified:true,first_seen:datetime(),_tenant:$t}) CREATE (i2:Identity {identity_id:$id2,type:'phone',value:$phone,source:'crm',strength:'strong',verified:true,first_seen:datetime(),_tenant:$t}) CREATE (p)-[:HAS_IDENTITY]->(i1) CREATE (p)-[:HAS_IDENTITY]->(i2)`,{pid,t:T,email,phone,id1:`id_${uuidv4().slice(0,8)}`,id2:`id_${uuidv4().slice(0,8)}`});

    const jt = journey(tier);
    const prod = PRODUCTS[i % PRODUCTS.length];
    const agent = AGENTS[i % AGENTS.length];
    const pay = wPick(PAYMENTS, PAYMENT_W);
    const returnReason = pick((RETURN_REASONS as Record<string,string[]>)[prod.category] || ["quality_not_as_expected"]);
    const off = ri(0,15);

    type E = {type:string;ago:number;status:string;amount?:number;conf:number;exc?:boolean;props?:Record<string,unknown>};
    const evts: E[] = [];

    if (jt==="browse") {
      for (let v=0;v<ri(3,10);v++) evts.push({type:"page_view",ago:60-v*4+off,status:"completed",conf:1.0});
      evts.push({type:"product_view",ago:25+off,status:"completed",conf:1.0});
    } else if (jt==="cart_abandon") {
      evts.push({type:"page_view",ago:22+off,status:"completed",conf:1.0});
      evts.push({type:"product_view",ago:20+off,status:"completed",conf:1.0});
      evts.push({type:"add_to_cart",ago:18+off,status:"completed",conf:1.0,amount:prod.price});
      evts.push({type:"remove_from_cart",ago:17+off,status:"completed",conf:1.0});
      if (Math.random()<0.5) evts.push({type:"add_to_cart",ago:10+off,status:"completed",conf:1.0});
    } else if (jt==="seasonal") {
      evts.push({type:"page_view",ago:8+off,status:"completed",conf:1.0});
      evts.push({type:"add_to_cart",ago:7+off,status:"completed",conf:1.0});
      evts.push({type:"purchase",ago:6+off,status:"completed",conf:1.0,amount:Math.round(prod.price*0.7),props:{discount_pct:30,campaign:"EORS"}});
      evts.push({type:"delivery_completed",ago:2+off,status:"completed",conf:1.0});
      if (Math.random()<0.35) evts.push({type:"return_initiated",ago:1,status:"completed",conf:0.87,amount:prod.price,props:{reason:returnReason}});
    } else if (jt==="churned") {
      evts.push({type:"purchase",ago:180+off,status:"completed",conf:1.0,amount:prod.price});
      evts.push({type:"support_ticket",ago:160+off,status:"completed",conf:0.88,props:{issue:pick(ISSUES)}});
      evts.push({type:"support_ticket",ago:145+off,status:"completed",conf:0.85,props:{issue:pick(ISSUES)}});
      evts.push({type:"return_initiated",ago:135+off,status:"completed",conf:0.90,amount:prod.price,props:{reason:returnReason}});
    } else if (jt==="repeat") {
      const cycles = ri(2,4);
      for (let c=0;c<cycles;c++) {
        const rp = PRODUCTS[(i+c*3)%PRODUCTS.length];
        const base = (cycles-c)*50+off;
        evts.push({type:"product_view",ago:base+5,status:"completed",conf:1.0});
        evts.push({type:"purchase",ago:base,status:"completed",conf:1.0,amount:rp.price,props:{payment_method:pay}});
        evts.push({type:"delivery_completed",ago:base-5,status:"completed",conf:1.0});
        if (c===cycles-1&&Math.random()<0.7) evts.push({type:"review_submitted",ago:base-8,status:"completed",conf:0.95,props:{rating:ri(4,5)}});
      }
    } else if (jt==="return") {
      const dsp = ri(22,45);
      const isExc = (tier==="Gold"||tier==="Platinum")&&dsp>30;
      evts.push({type:"product_view",ago:dsp+12+off,status:"completed",conf:1.0});
      evts.push({type:"add_to_cart",ago:dsp+10+off,status:"completed",conf:1.0});
      evts.push({type:"purchase",ago:dsp+off,status:"completed",conf:1.0,amount:prod.price,props:{payment_method:pay}});
      evts.push({type:"delivery_completed",ago:dsp-5+off,status:"completed",conf:1.0});
      evts.push({type:"return_initiated",ago:ri(2,10),status:isExc?"exception":"completed",conf:0.87,amount:prod.price,exc:isExc,props:{reason:returnReason,day_since_purchase:dsp}});
      if (Math.random()<0.75) evts.push({type:"refund_issued",ago:1,status:pay==="COD"?"pending":"completed",conf:0.92,amount:prod.price});
    } else if (jt==="support") {
      evts.push({type:"purchase",ago:35+off,status:"completed",conf:1.0,amount:prod.price});
      evts.push({type:"delivery_completed",ago:30+off,status:"completed",conf:1.0});
      for (let tk=0;tk<ri(1,3);tk++) evts.push({type:"support_ticket",ago:25-tk*6+off,status:"completed",conf:0.88,props:{issue:pick(ISSUES)}});
      if (Math.random()<0.55) evts.push({type:"return_initiated",ago:5+off,status:"completed",conf:0.85,amount:prod.price,props:{reason:returnReason}});
    } else {
      // happy
      evts.push({type:"page_view",ago:35+off,status:"completed",conf:1.0});
      evts.push({type:"product_view",ago:33+off,status:"completed",conf:1.0});
      evts.push({type:"add_to_cart",ago:31+off,status:"completed",conf:1.0});
      evts.push({type:"purchase",ago:30+off,status:"completed",conf:1.0,amount:prod.price,props:{payment_method:pay}});
      evts.push({type:"delivery_completed",ago:25+off,status:"completed",conf:1.0});
      if (Math.random()<0.65) evts.push({type:"review_submitted",ago:22+off,status:"completed",conf:0.95,props:{rating:ri(4,5)}});
    }

    let prevId: string|null = null;
    for (const e of evts) {
      const eid = `evt_${uuidv4().slice(0,8)}`;
      await runQuery(
        `MATCH (p:Profile {profile_id:$pid,_tenant:$t}) CREATE (ev:Event {id:$eid,event_type:$type,timestamp:datetime($ts),status:$status,amount:$amount,method:$method,channel:$ch,exception:$exc,confidence_score:$conf,properties:$props,_tenant:$t,created_at:datetime()}) CREATE (p)-[:PERFORMED]->(ev)`,
        {pid,t:T,eid,type:e.type,ts:da(e.ago),status:e.status,amount:e.amount||null,method:e.props?.payment_method||pick(PAYMENTS),ch:pick(CHANNELS),exc:e.exc||false,conf:e.conf,props:JSON.stringify(e.props||{})}
      );
      if (prevId) await runQuery(`MATCH (a:Event {id:$a,_tenant:$t}) MATCH (b:Event {id:$b,_tenant:$t}) CREATE (a)-[:NEXT]->(b)`,{a:prevId,b:eid,t:T});
      prevId = eid;

      if (["product_view","add_to_cart","purchase","return_initiated"].includes(e.type))
        await runQuery(`MATCH (ev:Event {id:$eid,_tenant:$t}) MATCH (p:Product {product_id:$pid,_tenant:$t}) MERGE (ev)-[:INVOLVES]->(p)`,{eid,t:T,pid:prod.product_id});

      if (e.type==="return_initiated") {
        const polId = i<25?"return_v3.1":"return_v3.2";
        await runQuery(`MATCH (ev:Event {id:$eid,_tenant:$t}) MATCH (pol:Policy {policy_id:$pid,_tenant:$t}) CREATE (ev)-[:${e.exc?"OVERRODE":"GOVERNED_BY"}]->(pol)`,{eid,t:T,pid:polId});
        await runQuery(`MATCH (ev:Event {id:$eid,_tenant:$t}) MATCH (a:Agent {agent_id:$aid,_tenant:$t}) CREATE (ev)-[:HANDLED_BY]->(a)`,{eid,t:T,aid:agent.agent_id});
      }

      if (e.type==="refund_issued") {
        const dl = new Date(); dl.setDate(dl.getDate()-(e.ago-2));
        const cid = `commit_${uuidv4().slice(0,8)}`;
        await runQuery(
          `MATCH (p:Profile {profile_id:$pid,_tenant:$t}) MATCH (ev:Event {id:$eid,_tenant:$t}) CREATE (c:Commitment {commitment_id:$cid,promise_text:'Refund within 48 hours',deadline:datetime($dl),status:$status,assignee:$assignee,confidence_score:0.92,_tenant:$t,created_at:datetime()}) CREATE (p)-[:HAS_COMMITMENT]->(c) CREATE (ev)-[:CREATED_COMMITMENT]->(c)`,
          {pid,t:T,eid,cid,dl:dl.toISOString(),status:dl<new Date()?"breached":"open",assignee:agent.name}
        );
      }
      ev++;
    }
  }
  return {profiles:200,events:ev};
}
