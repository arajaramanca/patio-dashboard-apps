Ext.define('CA.techservices.validation.TaskRequiredFieldRule',{
    extend: 'CA.techservices.validation.BaseRule',
    alias:  'widget.tstaskrequiredfieldrule',
    
   
    config: {
        model: 'Task',
        requiredFields: [],
        label: 'Required Fields are missing (task)'
    },
//    
    getFetchFields: function() {
        return this.requiredFields;
    },
    
    getModel: function() {
        return this.model;
    },
    
    applyRuleToRecord: function(record) {
        var missingFields = [];

        Ext.Array.each(this.requiredFields, function (field_name) {
            var field_defn = record.getField(field_name);
            var value = record.get(field_name);
            
            if ( !Ext.isEmpty(field_defn) && Ext.isEmpty(value) ) {
                missingFields.push(record.getField(field_name).displayName);
            }
        });
        if (missingFields.length === 0) {
            return false;
        }
        return Ext.String.format('Fields Missing: {0}', missingFields.join(','))
    }
});