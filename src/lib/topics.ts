// Topic of each built-in exam question, keyed by the question hash (see parseQuiz). A "主題:" line in a quiz overrides this.
export const TOPICS = ["國際氣候公約與 COP","碳市場、碳權與碳定價","企業倡議與永續揭露","CBAM 與碳洩漏","臺灣淨零路徑與能源轉型","淨零概念與碳中和","盤查邊界與控制權","排放類別與排放源鑑別","排放量計算與係數","數據品質、報告書與查證","產品碳足跡與生命週期"]

/** Subject each topic belongs to, used to group the weakness report. */
export const TOPIC_SUBJECT: Record<string, string> = {
  "國際氣候公約與 COP": "第一科",
  "碳市場、碳權與碳定價": "第一科",
  "企業倡議與永續揭露": "第一科",
  "CBAM 與碳洩漏": "第一科",
  "臺灣淨零路徑與能源轉型": "第一科",
  "淨零概念與碳中和": "第一科",
  "盤查邊界與控制權": "第二科",
  "排放類別與排放源鑑別": "第二科",
  "排放量計算與係數": "第二科",
  "數據品質、報告書與查證": "第二科",
  "產品碳足跡與生命週期": "第二科",
}

const BY_KEY: Record<string, number> = {"9l26ef":2,"g9gnov":0,"mzcou0":1,"76pc4v":0,"1egv1jy":2,"dlbow5":4,"eegtin":4,"1d37zl3":4,"1keroin":4,"nj66oj":4,"1bsll1g":4,"1ixv8pk":2,"wq5nq6":2,"khzahb":2,"1tn3ovk":2,"1rfjuan":1,"1fcwcz1":0,"s0u3t4":1,"gc5dbf":1,"7mnfa2":1,"qk4y75":2,"1hh6ir9":2,"1r8mf1y":2,"28zb9b":2,"eepfed":2,"1nxsu98":4,"1cmviph":3,"5659j7":2,"lgxi5m":3,"1ki85r7":3,"152x6ut":3,"14ubrxt":3,"jj0awn":4,"165pjwu":4,"jcdzo6":2,"1uh3ofw":4,"uessct":4,"1fstjo9":4,"8x1chr":3,"12epytq":1,"ij0fsy":1,"kb9ark":1,"hi1rhh":1,"qiy977":1,"1xzex2b":5,"1c4y5ju":5,"119jur9":5,"z47a84":5,"6n8id4":5,"1vvn4bw":5,"stniy3":0,"k1oax4":0,"157gnek":0,"8yp5za":1,"1sies6y":0,"1va7h1i":2,"hty1g8":4,"ripuae":4,"1yhvn9j":4,"x8m2c6":4,"13dw2yz":5,"16s4fuu":1,"7tilbs":5,"11s2z8p":5,"1pixoud":5,"135sslu":2,"ycfcch":1,"1vj3wsn":5,"gl0k68":2,"1vc0bva":2,"7camj7":2,"1sbadrd":2,"x3s9of":2,"7dvswy":2,"paqzuy":2,"bhz0cm":2,"14xbm8j":3,"a63ae9":3,"5dtqir":3,"kvwhvs":3,"u6plt3":3,"g3rnbi":3,"1cp9b7k":4,"7pqsaw":4,"uysm7l":4,"1o6a0qg":4,"1tw11e0":4,"1umth72":3,"9yleh7":1,"1fcywxy":1,"7mclr6":1,"mt0yu8":4,"90amn3":1,"1wlflyl":5,"n32nsv":1,"1ux8qvw":5,"l9wig":5,"t6of46":5,"1bcl65o":5,"17q1agg":5,"rw92ik":8,"1ug3b1c":7,"1i99kxz":7,"1woit73":6,"lyqp7d":9,"1fhdnyk":9,"18ezlus":7,"20hi91":8,"1rqee0v":8,"2ibpuc":6,"rjnd1u":6,"3n9ai2":6,"1hjsei3":7,"3a3b5k":7,"1m2dat4":7,"haxecn":8,"zuwu3u":8,"13gvdco":8,"8q7075":8,"8amvw5":8,"1tocadm":8,"1kzmw1q":7,"hkzb9u":8,"9ld040":9,"1co8jfe":9,"17ez6kc":9,"uzpjfj":9,"fdoyjd":9,"iiencz":9,"197equi":9,"1hetux8":10,"1enb3c6":10,"11rksbm":10,"xepyxn":8,"3sxezg":10,"1asnbqu":10,"10br8ix":10,"of3gaj":10,"17l59hj":10,"ro73rc":7,"1gzhfvg":8,"nvu34m":10,"1y9mlo7":10,"gz2fuj":10,"19ls8ao":10,"103ja2d":10,"1cven4":10,"3su3gz":10,"17a2hxb":10,"y2khnn":10,"jlep6p":9,"flw1yh":8,"1c9fp6q":8,"3vfyuj":9,"l2irq5":6,"hr03mk":9,"1992hvp":9,"1wudu6c":6,"xng7r8":6,"1mfgqd1":6,"1ejd07e":6,"1gh6voi":6,"1hzsqcw":6,"w1yjxi":6,"rhkfdv":8,"1eadhip":8,"nu1d5r":9,"16gcey4":8,"baiai9":8,"qjrpc8":6,"1ffhr19":8,"gwyj7f":9,"1hd9mgl":9,"11ibsyd":9,"cco2jt":9,"qc0aq9":9,"x4xo92":9,"1v210db":9,"cgkgzm":10,"1cfozzp":10,"8u66rl":10,"wciwtd":10,"1r078ma":10,"1buk0d0":10,"jdvj1q":10,"1h9eqik":10,"rcyedm":10,"47fqko":10,"1wwbho4":10,"ddx728":10,"fblp3z":10,"1eqqt0b":10,"1k2lb1f":10,"dfm6tr":10,"1rrc1qv":10,"11yfmcq":10,"1nuazow":10,"uye0mz":10,"16mdqng":10,"e897sf":10}

export const UNCLASSIFIED = '未分類'

export function topicOfKey(key: string): string {
  const i = BY_KEY[key]
  return i === undefined ? UNCLASSIFIED : TOPICS[i]
}
