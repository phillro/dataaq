/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 3:31 PM
 */
module.exports = {

    production:{
        redis:{
            port:6379,
            host:'localhost',
        },

        mongo:{
          'user':'',
          'password':'',
          'db':'venues',
          'port':27017,
          'host':'localhost',
          "model_collection_mapping":{
            "VenueCount":"venue_city_counts",
            "RestaurantMerged":"restaurants2"
          }
        },
        jobRoot:__dirname + '/../lib/jobs/',
        aws:{
            accessKey:'AKIAJBMQ5STR5HGIHD4Q',
            secretAccessKey:'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'
        },


        s3DataBucket:'skyfetch-data',

        proxyCloudList:[],
    }


}