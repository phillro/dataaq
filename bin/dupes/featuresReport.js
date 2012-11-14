
function mapSumFeatures() {
    var fields = ["24hours","byob","barscene","brunchdaily","buffet","businessdining","businesslunch","celebspotting","cheapeats","classicny","deliveryafter10pm","designstandout","dineatthebar","familystyle","fireplace","foodtruck/cart","glutenfreeitems","greatdesserts","happyhour","hotspot","kidfriendly","kidfriendly","kidsmenu","latenightdining","liveentertainment","livemusic","lunchspecial","notablechef","notablewinelist","onlineordering","onlinereservations","open24hours","openkitchens/watchthechef","openlate","peoplewatching","pre/posttheater","privatedining/partyspace","prixfixe","rawbar","reservationsnotrequired","romantic","smokingarea","specialoccasion","tastingmenu","teatime","teenappeal","theaterdistrict","trendy","view","waterfront","transportation","attire","parking","goodformeal","alchohol","ambience","noiselevel","creditcards","delivery","groups","kids","reservations","takeout","tableservice","outdoorseating","wifi","tv","caters","wheelchair","goodviews","cuisine","menujson","pricestring","tips","fsqspecials","fsqlikes","fsqphrases","fsqcatids","menuurl"];
    if(this.data){
        for(var f in this.data){
           if(fields.indexOf(f.toLowerCase())>-1){
               emit(f,{count:1,field:f});
           }
        }
    }

}

function reduceSumFeatures(key, values) {
    var fCount = {field:key,count:values.length};
    return fCount;
}


function finalizeFeatureSum(key, values) {
    var fCount = {field:key,count:values.count};
        return fCount;
}

db.scrapes.mapReduce(mapSumFeatures, reduceSumFeatures, {finalize:finalizeFeatureSum, out:'featurenames'});


if(this.data&&this.data.features){

    for(var i=0;i<this.data.features.length;i++){
        emit(this.data.features[i],{count:1,field:this.data.features[i], val:this.data.features})
        if(this.data.features[i].features){
            for (var j = 0; j < this.data.features[i].features.length; j++) {
                emit(this.data.features[i].features[j],{count:1,field:this.data.features[i].features[j]})
            }
        }
    }
}