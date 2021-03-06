Ext.define("TSDeliveryEffortTaskHours", {
    extend: 'CA.techservices.app.ChartApp',

    descriptions: [
        "<strong>Delivery Effort Task Hours</strong><br/>" +
            "<br/>" +
            "This dashboard shows how many hours are being spent on accepted stories during timeboxes,  " +
            "compared to the estimated hours and hours left to-do." +
            "<p/>" +
            "Click on a bar to see a table with the tasks from that timebox." +
            "<p/> " +
            "<ul/>" +
            "<li>The columns show the count of actual hours on the tasks associated " +
            "with stories accepted in the timebox.</li>" +
            "<li>The line shows the count of the estimated hours on the tasks " + 
            "associated with stories accepted in the timebox.</li>" + 
            "</ul>",
        "<strong>Delivery Effort Full Time Equivalents</strong><br/>"+
            "<br/>" +
            "This dashboard shows the number of actual FTEs spent on accepted stories during timeboxes,  " +
            "compared to the estimated FTEs and FTEs left to-do." +
            "<p/>" +
            "Click on a bar to see a table with the tasks from that timebox." +
            "<p/> " +
            "<ul/>" +
            "<li>The columns show the count of actual hours on the tasks associated " +
            "with stories accepted in the timebox.</li>" +
            "<li>The line shows the count of the estimated hours on the tasks " + 
            "associated with stories accepted in the timebox.</li>" + 
            "</ul>"

    ],
    
    integrationHeaders : {
        name : "TSDeliveryEffortTaskHours"
    },
    
    config: {
        chartLabelRotationSettings:{
            rotateNone: 0,
            rotate45: 10,
            rotate90: 15 
        },
        defaultSettings: {
            showPatterns: false
        }
    },
                        
    launch: function() {
        this.callParent();
        
        this.timebox_limit = 10;
        this.timebox_type = 'Iteration';
                
        this._addSelectors();
        this._updateData();
    },

    _addSelectors: function() {

        this.addToBanner({
            xtype: 'rallynumberfield',
            name: 'timeBoxLimit',
            itemId: 'timeBoxLimit',
            fieldLabel: 'Timebox Limit',
            value: 10,
            maxValue: 20,
            minValue: 1,            
            margin: '0 0 0 50',
            width: 150,
            allowBlank: false,  // requires a non-empty value
            listeners:{
                change:function(nf){
                    this.timebox_limit = nf.value;
                    this._updateData();
                },
                scope:this
            }
        });

        this.addToBanner({
            xtype      : 'radiogroup',
            fieldLabel : 'Timebox Type',
            margin: '0 0 0 50',
            width: 300,
            defaults: {
                flex: 1
            },
            layout: 'hbox',
            items: [
                {
                    boxLabel  : 'Iteration',
                    name      : 'timeBoxType',
                    inputValue: 'Iteration',
                    id        : 'radio1',
                    checked   : true                    
                }, {
                    boxLabel  : 'Release',
                    name      : 'timeBoxType',
                    inputValue: 'Release',
                    id        : 'radio2'
                }
            ],
            listeners:{
                change:function(rb){
                    this.timebox_type = rb.lastValue.timeBoxType;
                    this._updateData();
                },
                scope:this
            }
        });

    },
    
    _updateData: function() {
        var me = this;
        this.metric = "size";
        
        Deft.Chain.pipeline([
            this._fetchTimeboxes,
            this._sortTimeboxes,
            this._fetchArtifactsInTimeboxes
        ],this).then({
            scope: this,
            success: function(results) {
								this._sortObjectsbyTBDate(results);
                var artifacts_by_timebox = this._collectArtifactsByTimebox(results || []);
                this._makeTopChart(artifacts_by_timebox);
                this._makeRawTopGrid(artifacts_by_timebox);
                this._makeBottomChart(artifacts_by_timebox);
                this._makeRawBottomGrid(artifacts_by_timebox);
            },
            failure: function(msg) {
                Ext.Msg.alert('--', msg);
            }
        });
        
    },
    
    _fetchTimeboxes: function() {
        var me = this,
            deferred = Ext.create('Deft.Deferred');
                
        this.setLoading("Fetching timeboxes...");
        
        var start_date_field = TSUtilities.getStartFieldForTimeboxType(this.timebox_type);
        var end_date_field = TSUtilities.getEndFieldForTimeboxType(this.timebox_type);

        
        var config = {
            model:  this.timebox_type,
            limit: this.timebox_limit,
            pageSize: this.timebox_limit,
            fetch: ['Name',start_date_field,end_date_field],
            filters: [{property:start_date_field, operator: '<=', value: Rally.util.DateTime.toIsoString(new Date)}],
            sorters: [{property:end_date_field, direction:'DESC'}],
            context: {
                projectScopeUp: false,
                projectScopeDown: false
            }
        };
        
        return TSUtilities.loadWsapiRecords(config);
    },
    
    _sortTimeboxes: function(timeboxes) {

				if (timeboxes === 'undefined' || timeboxes.length === 0) { 
            Ext.Msg.alert('', 'The project you selected does not have any ' + this.timebox_type + 's');
            this.setLoading(false);					
						return [];
				}

        var end_date_field = TSUtilities.getEndFieldForTimeboxType(this.timebox_type);
        
        Ext.Array.sort(timeboxes, function(a,b){
            if ( a.get(end_date_field) < b.get(end_date_field) ) { return -1; }
            if ( a.get(end_date_field) > b.get(end_date_field) ) { return  1; }
            return 0;
        });
        this.timeboxes = timeboxes;
        return timeboxes;
    },
    
    _sortObjectsbyTBDate: function(records) {
    	
        var end_date_field = TSUtilities.getEndFieldForTimeboxType(this.timebox_type);

				for (i=0; i < records.length; i++) { 
					records[i].sort_field = records[i]['data'][this.timebox_type][end_date_field];
					};
     
        Ext.Array.sort(records, function(a,b){      	
            if ( a.sort_field < b.sort_field ) { return -1; }
            if ( a.sort_field > b.sort_field ) { return  1; }
            return 0;
        }); 

        return records;

    },

    _fetchArtifactsInTimeboxes: function(timeboxes) {
        if ( timeboxes.length === 0 ) { return; }
        
        var type_field = this.getSetting('typeField');
        
        var start_field = TSUtilities.getStartFieldForTimeboxType(this.timebox_type);
        var end_field = TSUtilities.getEndFieldForTimeboxType(this.timebox_type);
        
        var deferred = Ext.create('Deft.Deferred');
        var first_date = timeboxes[0].get(start_field);
        var last_date = timeboxes[timeboxes.length - 1].get(end_field);
        
        var filters = [
            {property: this.timebox_type + '.' + start_field, operator: '>=', value:first_date},
            {property: this.timebox_type + '.' + end_field, operator: '<=', value:last_date},
            {property:'WorkProduct.AcceptedDate', operator: '!=', value: null }
        ];
        
        var config = {
            model:'Task',
            limit: Infinity,
            filters: filters,
            fetch: ['FormattedID','Name','ScheduleState',this.timebox_type,'ObjectID',
                'PlanEstimate','Project','Release',type_field,'Actuals','Estimate',
                'ToDo','WorkProduct',start_field, end_field]
        };
        
        Deft.Chain.sequence([
            function() { 
                return TSUtilities.loadWsapiRecords(config);
            }
        ],this).then({
            success: function(results) {
                deferred.resolve(Ext.Array.flatten(results));
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },
    
    /* 
     * returns a hash of hashes -- key is iteration name value is
     * another hash where the records key holds a hash
     *    the records hash has a key for each allowed value 
     *    which then provides an array of items that match the allowed value 
     *    and timebox
     * as in
     * { "iteration 1": { "records": { "all": [o,o,o], "SPIKE": [o,o], "": [o] } } }
     */
    _collectArtifactsByTimebox: function(items) {
        var hash = {},
            timebox_type = this.timebox_type,
            type_field = this.getSetting('typeField'),
            allowed_types = this.allowed_types;
                
        if ( items.length === 0 ) { return hash; }


        var base_hash = {
            records: {
                all: []
            }
        };
        Ext.Array.each(allowed_types, function(value) {
            base_hash.records[value] = [];
        });
        
        var start_field = TSUtilities.getStartFieldForTimeboxType(this.timebox_type);
        var end_field = TSUtilities.getEndFieldForTimeboxType(this.timebox_type);
        
        Ext.Array.each(items, function(item){
            var timebox = item.get(timebox_type).Name;
            
            var start_date = Rally.util.DateTime.fromIsoString(item.get(timebox_type)[start_field]);

            var end_date = Rally.util.DateTime.fromIsoString(item.get(timebox_type)[end_field]);
        
            var sprint_days_excluding_weekend = Rally.technicalservices.util.Utilities.daysBetween(end_date,start_date,true);

            if ( Ext.isEmpty(hash[timebox])){
                
                hash[timebox] = Ext.Object.merge({}, Ext.clone(base_hash) );
            }
            
            hash[timebox].records.all.push(item);
            
            var type = item.get(type_field) || "";
            if ( Ext.isEmpty(hash[timebox].records[type]) ) {
                hash[timebox].records[type] = [];
            }
            hash[timebox].records[type].push(item);

            hash[timebox].records['SprintDaysExcludingWeekend'] = sprint_days_excluding_weekend;

        });
        
        return hash;
    },


    _makeRawTopGrid: function(artifacts_by_timebox) {
        var me = this;
        
        this.logger.log('_makeRawGrid', artifacts_by_timebox);
       
        var columns = [{dataIndex:'Name',text:'Hours Type'}];
        Ext.Array.each(this._getCategories(artifacts_by_timebox), function(field){
            columns.push({ dataIndex: me._getSafeIterationName(field) + "_number", text: field, align: 'center',flex:1});
        });
        
        this.logger.log('about to get Raw Rows');
        var rows = this._getRawTopRows(artifacts_by_timebox);
        
        this.logger.log('about to create store', rows);
        var store = Ext.create('Rally.data.custom.Store',{ data: rows });
        
        this.logger.log('about to add', store, columns);

        this.setGrid({
            xtype:'rallygrid',
            padding: 5,
            showPagingToolbar: false,
            enableEditing: false,
            showRowActionsColumn: false,     
            store: store,
            columnCfgs: columns
        });

    },
    
    _getRawTopRows: function(artifacts_by_timebox) {
        var me = this;
        // sprint objects have key = name of sprint
        
        var row_fields = this._getCategories(artifacts_by_timebox);
         
        this.logger.log('row_fields', row_fields);
        
        var rows = [
            {Type:'Actuals', Name: 'Actual Hours'},
            {Type:'ToDo',  Name: 'ToDo Hours' },
            {Type:'Estimate', Name: 'Estimated Hours' }
        ];

        // Ext.Array.each(this._getSeries(artifacts_by_timebox),function(rowname){
        //     rows.push({Type:rowname.name,Name:rowname.name});
        // })
        // set up fields
        
        Ext.Array.each(rows, function(row) {
            Ext.Array.each(row_fields, function(field){
                field = me._getSafeIterationName(field);
                row[field] = [];
                row[field + "_number"] = 0;
            });
        });
        
        this.logger.log('rows >>',rows);

        Ext.Array.each(rows, function(row){
            var type = row.Type;
            Ext.Object.each(artifacts_by_timebox, function(sprint_name,value){
                sprint_name = me._getSafeIterationName(sprint_name);
                var records = value.records.all || [];
                row[sprint_name + "_number"] = me._getTopSize(records,type); 
                
            });
        });
        
        return rows;
    },


    _makeRawBottomGrid: function(artifacts_by_timebox) {
        var me = this;
        
        this.logger.log('_makeRawGrid', artifacts_by_timebox);
       
        var columns = [{dataIndex:'Name',text:'Hours Type'}];
        Ext.Array.each(this._getCategories(artifacts_by_timebox), function(field){
            columns.push({ dataIndex: me._getSafeIterationName(field) + "_number", text: field, align: 'center',flex:1});
        });
        
        this.logger.log('about to get Raw Rows');
        var rows = this._getRawBottomRows(artifacts_by_timebox);
        
        this.logger.log('about to create store', rows);
        var store = Ext.create('Rally.data.custom.Store',{ data: rows });
        
        this.logger.log('about to add', store, columns);

        this.setGrid({
            xtype:'rallygrid',
            padding: 5,
            showPagingToolbar: false,
            enableEditing: false,
            showRowActionsColumn: false,     
            store: store,
            columnCfgs: columns
        },1);

    },
    
    _getRawBottomRows: function(artifacts_by_timebox) {
        var me = this;
        // sprint objects have key = name of sprint
        
        var row_fields = this._getCategories(artifacts_by_timebox);
         
        this.logger.log('row_fields', row_fields);
        
        var rows = [
            {Type:'Actuals', Name: 'Actual FTEs'},
            {Type:'ToDo',  Name: 'ToDo FTEs' },
            {Type:'Estimate', Name: 'Estimated FTEs' }
        ];

        // Ext.Array.each(this._getSeries(artifacts_by_timebox),function(rowname){
        //     rows.push({Type:rowname.name,Name:rowname.name});
        // })
        // set up fields
        
        Ext.Array.each(rows, function(row) {
            Ext.Array.each(row_fields, function(field){
                field = me._getSafeIterationName(field);
                row[field] = [];
                row[field + "_number"] = 0;
            });
        });
        
        this.logger.log('rows >>',rows);

        Ext.Array.each(rows, function(row){
            var type = row.Type;
            Ext.Object.each(artifacts_by_timebox, function(sprint_name,value){
                sprint_name = me._getSafeIterationName(sprint_name);

                row[sprint_name] = value[type];
                
                var records = value.records.all || [];
                
                row[sprint_name + "_number"] = me._getBottomSize(value,type); 
                
            });
        });
        
        return rows;
    },

    _makeTopChart: function(artifacts_by_timebox) {
        var me = this;

        var categories = this._getCategories(artifacts_by_timebox);
        var series = this._getSeries(artifacts_by_timebox);
        var colors = CA.apps.charts.Colors.getConsistentBarColors();
        this.logger.log('Top series>>',series);
        if ( this.getSetting('showPatterns') ) {
            colors = CA.apps.charts.Colors.getConsistentBarPatterns();
        }
        this.setChart({
            chartData: { series: series, categories: categories },
            chartConfig: this._getTopChartConfig(),
            chartColors: colors
        });
        this.setLoading(false);
    },
    


    _makeBottomChart: function(artifacts_by_timebox) {
        var me = this;

        var categories = this._getCategories(artifacts_by_timebox);
        // TODO: change series to have FTE calcs.
        var series = this._getBottomSeries(artifacts_by_timebox);
        var colors = CA.apps.charts.Colors.getConsistentBarColors();
        
        if ( this.getSetting('showPatterns') ) {
            colors = CA.apps.charts.Colors.getConsistentBarPatterns();
        }
        this.setChart({
            chartData: { series: series, categories: categories },
            chartConfig: this._getBottomChartConfig(),
            chartColors: colors
        },1);
        this.setLoading(false);
    },
    
    _getSeries: function(artifacts_by_timebox) {
        var series = [],
            allowed_types = this.allowed_types;
        
        console.log('--', artifacts_by_timebox);
    
        var name = "Actual Hours";
        series.push({
            name: name,
            data: this._calculateMeasure(artifacts_by_timebox,"Actuals",name),
            type: 'column',
            stack: 'a'
        });

        var name = "To Do Hours";
        series.push({
            name: name,
            data: this._calculateMeasure(artifacts_by_timebox,"ToDo",name),
            type: 'column',
            stack: 'a'
        });
        
        var name = "Estimated Hours";
        series.push({
            name: name,
            data: this._calculateMeasure(artifacts_by_timebox,"Estimate",name),
            type: 'line'
        });
        
        return series;
    },
    
    _getBottomSeries: function(artifacts_by_timebox) {
        var series = [],
            allowed_types = this.allowed_types;
        
        console.log('--', artifacts_by_timebox);
    
        var name = "Actual FTEs";
        series.push({
            name: name,
            data: this._calculateBottomMeasure(artifacts_by_timebox,"Actuals",name),
            type: 'column',
            stack: 'a'
        });

        var name = "To Do FTEs";
        series.push({
            name: name,
            data: this._calculateBottomMeasure(artifacts_by_timebox,"ToDo",name),
            type: 'column',
            stack: 'a'
        });
        
        var name = "Estimated FTEs";
        series.push({
            name: name,
            data: this._calculateBottomMeasure(artifacts_by_timebox,"Estimate",name),
            type: 'line'
        });
        
        return series;
    },

    _calculateMeasure: function(artifacts_by_timebox,hours_field,title) {
        var me = this,
            data = [];
        
        Ext.Object.each(artifacts_by_timebox, function(timebox, value){
            var records = value.records.all || [];
            data.push({ 
                y:me._getTopSize(records,hours_field),
                _records: records,
                events: {
                    click: function() {
                        me.showDrillDown(this._records,  title);
                    }
                }
            });
        });
        
        return data;
        
    },

    _getTopSize:function(records,hours_field){
   
        var size = Ext.Array.sum(
            Ext.Array.map(records, function(record){
                return record.get(hours_field) || 0;
            })
        );
        return size;
    },

    _calculateBottomMeasure: function(artifacts_by_timebox,hours_field,title) {
        var me = this,
            data = [];
        
        Ext.Object.each(artifacts_by_timebox, function(timebox, value){
            var records = value.records.all || [];

            data.push({ 
                y: me._getBottomSize(value,hours_field),
                _records: records,
                events: {
                    click: function() {
                        me.showDrillDown(this._records,  title);
                    }
                }
            });
        });
        
        return data;
        
    },    

    _getBottomSize:function(value,hours_field){
            var records = value.records.all || [];
            var size = Ext.Array.sum(
                Ext.Array.map(records, function(record){
                    return record.get(hours_field) || 0;
                })
            );
            
            //calculate full time equivalent ( number of hours in velocity / ( .8 * 8 * number of workdays in sprint) )
            if(size > 0){
                size = (value.records.SprintDaysExcludingWeekend * 8) / ( .8 * 8 * size);
            }

            return parseInt(size,10)
    },
    
    _getCategories: function(artifacts_by_timebox) {
        return Ext.Object.getKeys(artifacts_by_timebox);
    },
    
    _rotateLabels: function(){
        
        var rotationSetting = 0;

        if (this.timebox_limit <= this.chartLabelRotationSettings.rotate45) {
            rotationSetting = 0;
        } else if (this.timebox_limit <= this.chartLabelRotationSettings.rotate90){
            rotationSetting =  45;
        } else { // full vertical rotation for more than 10 items (good for up-to about 20)
            rotationSetting =  90;
        }
        
        return rotationSetting;
    },

    _getTopChartConfig: function() {
        var me = this;
        
        var timebox_name = "Release"; 
        if ( this.timebox_type == 'Iteration' ) {
            timebox_name = 'Sprint';
        }
        return {
            chart: { type:'column' },
            title: { text: 'Actual Task Hours by ' + timebox_name },
            xAxis: {
                labels:{
                    rotation:this._rotateLabels()
                }
            },
            yAxis: [{ 
                title: { text: 'Hours' }
            }],
            plotOptions: {
                column: {
                    stacking: 'normal'
                }
            },
            tooltip: {
                formatter: function() {
                    return '<b>'+ this.series.name +'</b>: '+ Ext.util.Format.number(this.point.y, '0.##');
                }
            }
        }
    },
    
    _getBottomChartConfig: function() {
        var me = this;
        
        var timebox_name = "Release"; 
        if ( this.timebox_type == 'Iteration' ) {
            timebox_name = 'Sprint';
        }
        
        return {
            chart: { type:'column' },
            title: { text: 'Actual FTEs by ' + timebox_name },
            xAxis: {
                labels:{
                    rotation:this._rotateLabels()
                }
            },
            yAxis: [{ 
                title: { text: 'FTEs' }
            }],
            plotOptions: {
                column: {
                    stacking: 'normal'
                }
            },
            tooltip: {
                formatter: function() {
                    return '<b>'+ this.series.name +'</b>: '+ Ext.util.Format.number(this.point.y, '0.##');
                }
            }
        }
    },
    
    getSettingsFields: function() {
        return [
        {
            name: 'typeField',
            xtype: 'rallyfieldcombobox',
            model: 'Task',
            _isNotHidden: function(field) {
                //console.log(field);
                if ( field.hidden ) { return false; }
                var defn = field.attributeDefinition;
                if ( Ext.isEmpty(defn) ) { return false; }
                
                return ( defn.Constrained && defn.AttributeType == 'STRING' );
            }
        },
        { 
            name: 'showPatterns',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin: '0 0 25 25',
            boxLabel: 'Show Patterns<br/><span style="color:#999999;"><i>Tick to use patterns in the chart instead of color.</i></span>'
        }
        
        ];
    },
    
    getDrillDownColumns: function(title) {
        var columns = [
            {
                dataIndex : 'FormattedID',
                text: "id"
            },
            {
                dataIndex : 'Name',
                text: "Name",
                flex: 2
            },
            {
                dataIndex: 'WorkProduct',
                text: 'Work Product',
                flex:2,
                renderer: function(value,meta,record) {
                    if ( Ext.isEmpty(value) ) { return ""; }
                    return value.FormattedID + ": " + value.Name;
                }
            },
            {
                dataIndex: 'Estimate',
                text: 'Task Hours (Est)'
            },
            {
                dataIndex: 'Actuals',
                text: 'Task Hours (Actual)'
            },
            {
                dataIndex: 'ToDo',
                text: 'Task Hours (To Do)'
            },
            {
                dataIndex: 'Project',
                text: 'Project',
                renderer:function(Project){
                        return Project.Name;
                },
                flex: 1
            }
        ];
        
        if ( /\(multiple\)/.test(title)) {
            columns.push({
                dataIndex: 'Name',
                text: 'Count of Moves',
                renderer: function(value, meta, record) {
                    
                    return value.split('[Continued]').length;
                }
            });
        }
        
        
        return columns;
    },
    /*
     * having a dot in the name for the key of a hash causes problems
     */
    _getSafeIterationName: function(name) {
        return name.replace(/\./,'&#46;'); 
    },
    
    _getUnsafeIterationName: function(name) {
        return name.replace(/&#46;/,'.');
    }
    
});
