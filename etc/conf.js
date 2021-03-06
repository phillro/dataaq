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
          'user':'mvenues',
          'password':'mv1us3r',
          'db':'manhattan_venues',
          'port':27017,
          'host':'localhost',
          "model_collection_mapping":{
            "VenueCount":"venue_city_counts",
            "RestaurantMerged":"restaurants2"
          }
        },
        jobRoot:__dirname + '/../lib/jobs/',
        aws:{
            accessKey:'***',
            secretAccessKey:'******'
        },


        s3DataBucket:'skyfetch-data',

        proxyCloudList:[],
    }


}
