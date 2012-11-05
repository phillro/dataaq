/**
 * User: philliprosen
 * Date: 9/14/12
 * Time: 6:19 PM
 */
/**
   *
   * @param name || array of sections
   * @param description
   * @param items
   * @param sections
   */

exports.MenuSection = MenuSection
/**
 *
 * @param name || array of sections
 * @param description
 * @param items
 * @param sections
 */
function MenuSection(name, description, items, sections) {
  if (arguments.length == 1 && typeof arguments == 'object') {
    this.sections = [];
    for (var i = 0; i < arguments[0].length; i++) {
      this.sections.push(new MenuSection(arguments[0][i].name, arguments[0][i].description, arguments[0][i].items, arguments[0][i].sections));
    }
  } else {
    this.name = name || '';
    this.description = description || '';
    this.items = arguments[2] || [];
    this.sections = arguments[3] || [];
    for (var i = 0; i < this.sections.length; i++) {
      var section = this.sections[i];
      if(!section instanceof  MenuSection){
        section = new MenuSection(section.name, section.description, section.items, section.sections);
      }
    }
  }
}

MenuSection.prototype.OrdrinChild = function (name, description, price, children) {
  this.name = name || '';
  this.descrip = description || '';
  this.price = price || '';
  this.children = children || [];
}

function parseMenuSection(section) {
  var childSection = new Child(section.name);
  if (section.items) {
    for (var i = 0; i < section.items.length; i++) {
      var item = section.items[i];
      var iC = new Child(item.name, item.description, item.price);
      childSection.children.push(ic);
    }
  }
  if (section.sections) {
    for (var i = 0; i < section.sections.length; i++) {
      var section = section.sections[i];
      if (!section instanceof MenuSection) {
        section = new MenuSection(section.name, section.description);
      }
      childSection.children.push((section));
    }
  }
  return childSection;
}

MenuSection.prototype.toOrdrinMenuNode = function () {
  var ordrinMenuNode = new this.OrdrinChild(this.name, this.description, this.price);
  if (this.items) {
    for (var i = 0; i < this.items.length; i++) {
      var item = this.items[i];
      var iC = new this.OrdrinChild(item.name, item.description, item.price);
      ordrinMenuNode.children.push(iC);
    }
  }
  if (this.sections) {
    for (var i = 0; i < this.sections.length; i++) {
      var section = this.sections[i];
      if (!section instanceof MenuSection) {
        section = new MenuSection(section.name, section.description);
      }
      ordrinMenuNode.children.push(section.toOrdrinMenuNode());
    }
  }
  return ordrinMenuNode;
}